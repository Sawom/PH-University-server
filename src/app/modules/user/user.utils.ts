import { TAcademicSemester } from "../academicSemester/academicSemester.interface";
import { User } from "./user.model";

const findLastStudentId = async () => {
  const lastStudent = await User.findOne(
    {
      role: "student",
    },
    // field filtering kortechi
    {
      id: 1,
      _id: 0,
    }
  ).sort({ createdAt: -1}).lean(); // createdAt er opr base kore decending order e sort kortechi

  // 203001 0001; last er 4 digit mane 0001 er sathe 1 zog hobe. tai substring diye 6digit katbo
  return lastStudent?.id ? lastStudent.id.substring(6) : undefined;
};

// year, semester, 4digit number
// id generated function
export const generateStudentId = async (payload: TAcademicSemester) => {
  // 1st time id 0000 theke start hoye +1 kore barbe
  // 4digit er number niye bakigula 0 boshay dibo

  // 1st time student zokhn enter hobe tokhn student er id hobe 0001. then +1 kore add hobe.
  // ei student gula decending order e sort hobe. last student ta 1st er dike zabe erpor +1 kore id barte thakbe
  const currentId = (await findLastStudentId()) || (0).toString();
  // id ctring format e ache. string er sathe number add kora zay na.
  // tai string k number e convert kore roll no +1 kore baray dibo
  let incrementId = (Number(currentId) + 1).toString().padStart(4, "0");

  incrementId = `${payload.year}${payload.code}${incrementId}`;
  return incrementId;
};
