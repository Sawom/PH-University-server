import httpStatus from "http-status";
import mongoose from "mongoose";
import QueryBuilder from "../../builder/QueryBuilder";
import AppError from "../../errors/AppError";
import { Course } from "../Course/course.model";
import { Faculty } from "../Faculty/faculty.model";
import { OfferedCourse } from "../OfferedCourse/OfferedCourse.model";
import { ModelofStudent } from "../student/student.model";
import { SemesterRegistration } from "./../semesterRegistration/semesterRegistration.model";
import { TEnrolledCourse } from "./enrolledCourse.interface";
import EnrolledCourse from "./enrolledCourse.model";

const createEnrolledCourseIntoDB = async (
  userId: string,
  payload: TEnrolledCourse
) => {
  /**
   * Step1: Check if the offered cousres is exists
   * Step2: Check if the student is already enrolled
   * Step3: Check if the max credits exceed
   * Step4: Create an enrolled course
   */
  const { offeredCourse } = payload;
  const isOfferedCourseExists = await OfferedCourse.findById(offeredCourse);

  if (!isOfferedCourseExists) {
    throw new AppError(httpStatus.NOT_FOUND, "offered course not found !");
  }

  if (isOfferedCourseExists.maxCapacity <= 0) {
    throw new AppError(httpStatus.BAD_GATEWAY, "Room is full !");
  }

  const student = await ModelofStudent.findOne({ id: userId }, { _id: 1 });

  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, "Student not found !");
  }

  const isStudentAlreadyEnrolled = await EnrolledCourse.findOne({
    semesterRegistration: isOfferedCourseExists?.semesterRegistration,
    offeredCourse,
    student: student._id,
  });

  if (isStudentAlreadyEnrolled) {
    throw new AppError(httpStatus.CONFLICT, "Student is already enrolled !");
  }

  // check total credits exceeds maxCredit
  const course = await Course.findById(isOfferedCourseExists.course);
  const currentCredit = course?.credits;

  const semesterRegistration = await SemesterRegistration.findById(
    isOfferedCourseExists.semesterRegistration
  ).select("maxCredit");

  const maxCredit = semesterRegistration?.maxCredit;

  const enrolledCourses = await EnrolledCourse.aggregate([
    {
      $match: {
        semesterRegistration: isOfferedCourseExists.semesterRegistration,
        student: student._id,
      },
    },
    {
      $lookup: {
        from: "courses",
        localField: "course",
        foreignField: "_id",
        as: "enrolledCourseData",
      },
    },
    {
      $unwind: "$enrolledCourseData",
    },
    {
      $group: {
        _id: null,
        totalEnrolledCredits: { $sum: "$enrolledCourseData.credits" },
      },
    },
    {
      $project: {
        _id: 0,
        totalEnrolledCredits: 1,
      },
    },
  ]);

  //  total enrolled credits + new enrolled course credit > maxCredit
  const totalCredits =
    enrolledCourses.length > 0 ? enrolledCourses[0].totalEnrolledCredits : 0;

  if (totalCredits && maxCredit && totalCredits + currentCredit > maxCredit) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have exceeded maximum number of credits !"
    );
  }

  //   transition & rollback
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const result = await EnrolledCourse.create(
      [
        {
          semesterRegistration: isOfferedCourseExists.semesterRegistration,
          academicSemester: isOfferedCourseExists.academicSemester,
          academicFaculty: isOfferedCourseExists.academicFaculty,
          academicDepartment: isOfferedCourseExists.academicDepartment,
          offeredCourse: offeredCourse,
          course: isOfferedCourseExists.course,
          student: student._id,
          faculty: isOfferedCourseExists.faculty,
          isEnrolled: true,
        },
      ],
      { session }
    );

    if (!result) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Failed to enroll in this cousre !"
      );
    }

    const maxCapacity = isOfferedCourseExists.maxCapacity;
    await OfferedCourse.findByIdAndUpdate(offeredCourse, {
      maxCapacity: maxCapacity - 1,
    });

    await session.commitTransaction();
    await session.endSession();
    return result;
  } catch (err: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(err);
  }
};

const getAllEnrolledCoursesFromDB = async (
  facultyId: string,
  query: Record<string, unknown>
) => {
  const faculty = await Faculty.findOne({ id: facultyId });

  if (!faculty) {
    throw new AppError(httpStatus.NOT_FOUND, "Faculty not found !");
  }

  const enrolledCourseQuery = new QueryBuilder(
    EnrolledCourse.find({
      faculty: faculty._id,
    }).populate(
      "semesterRegistration academicSemester academicFaculty academicDepartment offeredCourse course student faculty"
    ),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await enrolledCourseQuery.modelQuery;
  const meta = await enrolledCourseQuery.countTotal();

  return {
    meta,
    result,
  };
};
