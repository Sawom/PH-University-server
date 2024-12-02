export const calculateGradeAndPoints = (totalMarks: number) =>{
    let result = {
        grade: 'NA',
        gradePoints: 0,
    }
    /** grade scale
   * 0-19 F
   * 20-39 D
   * 40-59 C
   * 60-79 B
   * 80-100 A
   */

    if(totalMarks >=0 && totalMarks <= 19){
        result = {
            grade: 'F',
            gradePoints: 0.0,
        }
    }



}