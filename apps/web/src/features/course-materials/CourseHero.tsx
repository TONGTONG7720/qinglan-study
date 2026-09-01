import { Icon } from "../../components/Icon";
import type { CourseSummary } from "./types";

export interface CourseHeroProps {
  readonly course: CourseSummary;
  readonly detailsAvailable?: boolean;
  readonly onEnter: (course: CourseSummary) => void;
}

export function CourseHero({ course, detailsAvailable = true, onEnter }: CourseHeroProps) {
  return (
    <article className="course-hero" aria-labelledby="featured-course-title">
      <div className="course-hero-mark" aria-hidden="true">
        <Icon name="bookOpen" size={38} />
      </div>

      <div className="course-hero-copy">
        <h3 id="featured-course-title">{course.subjectLabel}</h3>
        <p className="course-hero-textbook">{course.textbookLabel}</p>
        <p className="course-hero-chapter">{course.currentChapter}</p>
        <p className="course-hero-progress-label">学习进度：{course.progressLabel}</p>
        <div
          aria-label={`学习进度 ${String(course.progressPercent)}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={course.progressPercent}
          className="progress-track"
          role="progressbar"
        >
          <span style={{ width: `${String(course.progressPercent)}%` }} />
        </div>
      </div>

      <button className="primary-button" disabled={!detailsAvailable} onClick={() => { onEnter(course); }} type="button">
        <span>{detailsAvailable ? "进入课程" : "课程详情暂未开放"}</span>
        <Icon name={detailsAvailable ? "arrowRight" : "shieldCheck"} size={18} />
      </button>
    </article>
  );
}
