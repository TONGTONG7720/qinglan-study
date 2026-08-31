import { Icon } from "../../components/Icon";
import type { CourseSummary, Grade, SubjectCode, Term } from "./types";

export interface CourseFiltersProps {
  readonly grade: Grade;
  readonly term: Term;
  readonly onGradeChange: (grade: Grade) => void;
  readonly onTermChange: (term: Term) => void;
}

export function CourseFilters({ grade, term, onGradeChange, onTermChange }: CourseFiltersProps) {
  return (
    <div className="course-filters" aria-label="课程筛选">
      <label className="compact-select">
        <span className="sr-only">年级</span>
        <select
          aria-label="选择年级"
          onChange={(event) => { onGradeChange(Number(event.target.value) as Grade); }}
          value={grade}
        >
          <option value={7}>七年级</option>
          <option value={8}>八年级</option>
          <option value={9}>九年级</option>
        </select>
        <Icon name="chevronRight" size={16} />
      </label>

      <label className="compact-select">
        <span className="sr-only">学期</span>
        <select
          aria-label="选择学期"
          onChange={(event) => { onTermChange(event.target.value as Term); }}
          value={term}
        >
          <option value="AUTUMN">上学期</option>
          <option value="SPRING">下学期</option>
        </select>
        <Icon name="chevronRight" size={16} />
      </label>
    </div>
  );
}

export interface CourseTableProps {
  readonly courses: readonly CourseSummary[];
  readonly selectedSubject: SubjectCode | null;
  readonly onSelect: (course: CourseSummary) => void;
}

export function CourseTable({ courses, selectedSubject, onSelect }: CourseTableProps) {
  if (courses.length === 0) {
    return (
      <div className="course-empty" role="status">
        <Icon name="info" size={22} />
        <div>
          <strong>当前筛选条件下没有课程</strong>
          <p>课程服务接入后，这里会展示该年级和学期的可用课程。</p>
        </div>
      </div>
    );
  }

  return (
    <div aria-label="课程列表" className="course-table">
      <div aria-hidden="true" className="course-table-head">
        <span>学科</span>
        <span>教材版本</span>
        <span>当前学习位置</span>
        <span aria-hidden="true" />
      </div>

      <div>
        {courses.map((course) => {
          const selected = course.subjectCode === selectedSubject;
          return (
            <button
              aria-label={`${course.subjectLabel}，${course.textbookLabel}，${course.currentPosition}`}
              aria-pressed={selected}
              className={`course-row${selected ? " is-selected" : ""}`}
              id={`course-row-${course.subjectCode.toLowerCase()}`}
              key={course.id}
              onClick={() => { onSelect(course); }}
              type="button"
            >
              <span className="course-subject">
                <Icon name="bookOpen" size={24} />
                <strong>{course.subjectLabel}</strong>
              </span>
              <span>{course.textbookLabel}</span>
              <span>{course.currentPosition}</span>
              <Icon className="course-row-arrow" name="arrowRight" size={18} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
