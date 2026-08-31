export type Grade = 7 | 8 | 9;
export type Term = "AUTUMN" | "SPRING";
export type SubjectCode =
  | "CHINESE"
  | "MATH"
  | "ENGLISH"
  | "MORALITY"
  | "HISTORY"
  | "PHYSICS"
  | "CHEMISTRY";

export type MaterialType = "TEXTBOOK" | "LECTURE_NOTE" | "EXERCISE" | "OCR_EVIDENCE";
export type SubjectDetailStatus =
  | "CONFIRMED_TEXTBOOK"
  | "GENERIC_GUIDANCE"
  | "PENDING_TEXTBOOK_VERIFICATION"
  | "NO_CURRENT_CHAPTER"
  | "PARTIAL_EVIDENCE"
  | "SUBJECT_NOT_APPLICABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type ChapterProgressStatus = "COMPLETED" | "CURRENT" | "NOT_STARTED";
export type TextbookDetailStatus =
  | "CONFIRMED_TEXTBOOK"
  | "GENERIC_GUIDANCE"
  | "PENDING_VERIFICATION"
  | "RETURNED_MATERIALS"
  | "CATALOG_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";
export type ChapterDetailStatus =
  | "NORMAL"
  | "LONG_CONTENT"
  | "GENERIC_GUIDANCE_MAPPING"
  | "EMPTY_CHAPTER"
  | "CHAPTER_ADJUSTED"
  | "CONTENT_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";
export type KnowledgePointDetailStatus =
  | "NORMAL"
  | "LONG_FORMULA_OR_PASSAGE"
  | "EVIDENCE_UNAVAILABLE"
  | "EMPTY_CONTENT"
  | "GENERIC_GUIDANCE"
  | "CONTENT_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";
export type KnowledgePointActionKind = "QUESTION" | "PRACTICE" | "EVIDENCE";
export type QuestionHubStatus =
  | "MODES_AVAILABLE"
  | "MISSING_CONTEXT"
  | "AI_UNAVAILABLE"
  | "BUDGET_EXHAUSTED"
  | "OFFLINE"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";
export type QuestionModeKind = "TEXT" | "IMAGE";
export type TextQuestionComposerStatus =
  | "EMPTY"
  | "DRAFT_LOCAL"
  | "DRAFT_SERVER"
  | "BUDGET_EXHAUSTED"
  | "RESULT_UNKNOWN"
  | "OFFLINE_DRAFT"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";
export type ImageQuestionUploadStatus =
  | "EMPTY"
  | "SELECTING_CROPPING"
  | "UPLOADING"
  | "INVALID_FILE"
  | "UNCLEAR_SCOPE"
  | "UPLOAD_FAILED"
  | "RESULT_UNKNOWN"
  | "OFFLINE_USE_TEXT"
  | "UPLOAD_SUCCEEDED"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";
export type OcrConfirmationStatus =
  | "LOW_CONFIDENCE_SEGMENTS"
  | "HIGH_CONFIDENCE_AWAITING_CONFIRM"
  | "STUDENT_CORRECTED"
  | "RECOGNIZING"
  | "OCR_FAILED"
  | "SOURCE_IMAGE_UNAVAILABLE"
  | "SUBMITTING"
  | "RESULT_UNKNOWN"
  | "OFFLINE_CANNOT_CONFIRM"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";
export type OcrSegmentConfidence = "HIGH" | "LOW";
export type TutorSessionStatus =
  | "FIRST_HINT"
  | "WAITING_ANSWER"
  | "PROGRESSIVE_REVEAL"
  | "EVIDENCE_AVAILABLE"
  | "EVIDENCE_UNAVAILABLE"
  | "MODEL_TIMEOUT"
  | "SAFE_REFERRAL"
  | "BUDGET_EXHAUSTED"
  | "OFFLINE"
  | "SESSION_EXPIRED_RECOVERABLE"
  | "DENIED_AS_NOT_FOUND";
export type TutorResultStatus =
  | "LOADING"
  | "COMPLETED_UNDERSTOOD"
  | "COMPLETED_NEEDS_PRACTICE"
  | "EVIDENCE_UNAVAILABLE"
  | "RESULT_UNKNOWN"
  | "SESSION_EXPIRED_READONLY"
  | "OFFLINE"
  | "DENIED_AS_NOT_FOUND";
export type TutorResultTimelineState = "COMPLETED" | "USED" | "PENDING" | "ERROR";
export type TutorResultReportStatus = "REPORT_IDLE" | "REPORT_SUBMITTING" | "REPORT_SUCCESS" | "REPORT_FAILURE";
export type PracticeHubStatus =
  | "LOADING"
  | "WITH_RECOMMENDATIONS"
  | "NO_RECOMMENDATIONS"
  | "FILTER_EMPTY"
  | "CURRENT_KNOWLEDGE_POINT_UNAVAILABLE"
  | "RECOMMENDATION_UNAVAILABLE"
  | "OFFLINE"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";
export type PracticeHubFilter = "ALL" | "CURRENT_KNOWLEDGE_POINT" | "WRONG_BOOK_RECOVERY";
export type PracticeRecommendationKind = "CURRENT_KNOWLEDGE_POINT" | "WRONG_BOOK_RECOVERY";
export type PracticeRecommendationBadgeTone = "CURRENT" | "DUE";

export interface SubjectChapterRow {
  readonly id: string;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly durationLabel: string;
  readonly status: ChapterProgressStatus;
  readonly statusLabel: string;
}

export interface SubjectResourceRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly materialType: MaterialType;
}

export interface SubjectRecentLearningRow {
  readonly id: string;
  readonly label: string;
  readonly happenedAtLabel: string;
  readonly materialType: MaterialType;
}

export interface SubjectEvidenceRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly materialType: MaterialType;
}

export interface SubjectDetail {
  readonly status: SubjectDetailStatus;
  readonly breadcrumbSubject: string;
  readonly title: string;
  readonly subtitle: string;
  readonly chapterNumberLabel: string;
  readonly chapterTitle: string;
  readonly textbookLine: string;
  readonly chapterProgressLabel: string;
  readonly currentLessonLabel: string;
  readonly progressPercent: number;
  readonly chapters: readonly SubjectChapterRow[];
  readonly goals: readonly string[];
  readonly resources: readonly SubjectResourceRow[];
  readonly recentLearning: readonly SubjectRecentLearningRow[];
  readonly evidence: readonly SubjectEvidenceRow[];
  readonly aiTutorQuestion: string;
  readonly sourceBoundary: string;
}

export interface TextbookChapterRow {
  readonly id: string;
  readonly chapterId: string;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly scope: string;
  readonly pageRange: string;
  readonly status: ChapterProgressStatus;
  readonly statusLabel: string;
}

export interface DefinitionRow {
  readonly id: string;
  readonly semanticKey?: string;
  readonly label: string;
  readonly value: string;
}

export interface CurrentTextbookChapterSummary {
  readonly chapterId: string;
  readonly chapterLabel: string;
  readonly title: string;
  readonly scope: string;
  readonly pageRange: string;
  readonly recentProgress: string;
  readonly actionLabel: string;
}

export interface TextbookDetail {
  readonly status: TextbookDetailStatus;
  readonly subjectLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fixtureBadgeLabel?: string;
  readonly heroNumberLabel: string;
  readonly gradeLabel: string;
  readonly textbookLabel: string;
  readonly confirmationLabel: string;
  readonly sourceLabel: string;
  readonly confirmedAtLabel: string;
  readonly chapters: readonly TextbookChapterRow[];
  readonly currentChapter: CurrentTextbookChapterSummary;
  readonly sourceRows: readonly DefinitionRow[];
  readonly verificationRows: readonly DefinitionRow[];
  readonly catalogRows: readonly DefinitionRow[];
  readonly serviceRows: readonly DefinitionRow[];
  readonly sourceNotice?: string;
  readonly sourceBoundary: string;
}

export interface ChapterKnowledgePointRow {
  readonly id: string;
  readonly targetId: string | null;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly durationLabel: string;
  readonly status: ChapterProgressStatus;
  readonly statusLabel: string;
  readonly basisLabel: string;
}

export interface ChapterFlowStepRow {
  readonly id: string;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly durationLabel: string;
  readonly targetId: string | null;
}

export interface ChapterResourceRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly materialType: MaterialType;
}

export interface ChapterCompletionConditionRow {
  readonly id: string;
  readonly label: string;
  readonly statusLabel: string;
  readonly completed: boolean;
}

export interface ChapterEvidenceStatusRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly materialType: MaterialType;
}

export interface ChapterDetail {
  readonly id: string;
  readonly chapterId: string;
  readonly status: ChapterDetailStatus;
  readonly subjectLabel: string;
  readonly breadcrumbChapterLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fixtureBadgeLabel?: string;
  readonly lessonNumberLabel: string;
  readonly textbookLine: string;
  readonly durationLabel: string;
  readonly stepCountLabel: string;
  readonly progressStatusLabel: string;
  readonly actionLabel: string;
  readonly textbookActionLabel: string;
  readonly primaryTargetId: string | null;
  readonly stageLabels: readonly string[];
  readonly goals: readonly string[];
  readonly coreKnowledgeRows: readonly DefinitionRow[];
  readonly knowledgePoints: readonly ChapterKnowledgePointRow[];
  readonly flowSteps: readonly ChapterFlowStepRow[];
  readonly basisRows: readonly DefinitionRow[];
  readonly resources: readonly ChapterResourceRow[];
  readonly completionConditions: readonly ChapterCompletionConditionRow[];
  readonly evidence: readonly ChapterEvidenceStatusRow[];
  readonly serviceRows: readonly DefinitionRow[];
  readonly aiTutorQuestion: string;
  readonly sourceBoundary: string;
}

export interface KnowledgePointRuleStep {
  readonly id: string;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly tokenLabel: string;
  readonly description: string;
}

export interface KnowledgePointExampleRow {
  readonly id: string;
  readonly expression: string;
  readonly result: string;
}

export interface KnowledgePointActionRow {
  readonly id: string;
  readonly kind: KnowledgePointActionKind;
  readonly label: string;
  readonly summary: string;
  readonly actionLabel: string;
  readonly targetId: string | null;
}

export interface KnowledgePointDetail {
  readonly id: string;
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly status: KnowledgePointDetailStatus;
  readonly subjectLabel: string;
  readonly breadcrumbChapterLabel: string;
  readonly breadcrumbKnowledgeLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fixtureBadgeLabel?: string;
  readonly keyCountLabel: string;
  readonly keyCountCaption: string;
  readonly formula: string;
  readonly formulaAriaLabel: string;
  readonly formulaDescription: string;
  readonly textbookLine: string;
  readonly durationLabel: string;
  readonly progressStatusLabel: string;
  readonly primaryActionLabel: string;
  readonly returnChapterLabel: string;
  readonly textbookActionLabel: string;
  readonly primaryTargetId: string | null;
  readonly ruleSteps: readonly KnowledgePointRuleStep[];
  readonly exampleTitle: string;
  readonly exampleFormula: string;
  readonly exampleFormulaAriaLabel: string;
  readonly exampleRows: readonly KnowledgePointExampleRow[];
  readonly examplePlotDescription: string;
  readonly basisRows: readonly DefinitionRow[];
  readonly actionRows: readonly KnowledgePointActionRow[];
  readonly infoRows: readonly DefinitionRow[];
  readonly keyRows: readonly DefinitionRow[];
  readonly contentRows: readonly DefinitionRow[];
  readonly relatedStatusRows: readonly DefinitionRow[];
  readonly serviceRows: readonly DefinitionRow[];
  readonly tutorQuestion: string;
  readonly tutorActionLabel: string;
  readonly tutorTargetId: string | null;
  readonly tutorBoundary: string;
  readonly sourceBoundary: string;
}

export interface QuestionModeOption {
  readonly id: string;
  readonly kind: QuestionModeKind;
  readonly badgeLabel?: string;
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly string[];
  readonly notes: readonly string[];
  readonly actionLabel: string;
  readonly targetId: string | null;
}

export interface NonAiFallbackLink {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly actionLabel: string;
  readonly targetId: string | null;
  readonly actionKind: KnowledgePointActionKind;
}

export interface QuestionHub {
  readonly id: string;
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly status: QuestionHubStatus;
  readonly subjectLabel: string;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fixtureBadgeLabel?: string;
  readonly contextTitle: string;
  readonly contextRows: readonly DefinitionRow[];
  readonly contextConfirmedLabel: string;
  readonly contextActionLabel: string;
  readonly contextNotice: string;
  readonly modeCountLabel: string;
  readonly modeCountCaption: string;
  readonly modeTitle: string;
  readonly modeDescription: string;
  readonly modeStatusLabel: string;
  readonly modeOptions: readonly QuestionModeOption[];
  readonly precheckTitle: string;
  readonly precheckRows: readonly string[];
  readonly aiUnavailableTitle: string;
  readonly aiUnavailableDescription: string;
  readonly fallbackLinks: readonly NonAiFallbackLink[];
  readonly railContextRows: readonly DefinitionRow[];
  readonly aiStatusRows: readonly DefinitionRow[];
  readonly budgetRows: readonly DefinitionRow[];
  readonly questionRecordRows: readonly DefinitionRow[];
  readonly privacyRules: readonly string[];
  readonly serviceRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export interface TextQuestionCheckRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly completed: boolean;
}

export interface TextQuestionComposer {
  readonly id: string;
  readonly targetId: string;
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly status: TextQuestionComposerStatus;
  readonly subjectLabel: string;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fixtureBadgeLabel?: string;
  readonly heroCountLabel: string;
  readonly heroTitle: string;
  readonly heroDescription: string;
  readonly draftStateLabel: string;
  readonly draftScopeLabel: string;
  readonly contextTitle: string;
  readonly contextRows: readonly DefinitionRow[];
  readonly contextNotice: string;
  readonly descriptionLabel: string;
  readonly descriptionHelp: string;
  readonly descriptionPlaceholder: string;
  readonly descriptionMaxLength: number;
  readonly descriptionPrivacyHint: string;
  readonly attemptLabel: string;
  readonly attemptHelp: string;
  readonly attemptPlaceholder: string;
  readonly attemptMaxLength: number;
  readonly attemptPrivacyHint: string;
  readonly privacyConfirmationLabel: string;
  readonly submitDisabledHint: string;
  readonly submitReadyHint: string;
  readonly submitUnavailableMessage: string;
  readonly submitButtonLabel: string;
  readonly imageModeLabel: string;
  readonly returnKnowledgeLabel: string;
  readonly returnHubLabel: string;
  readonly imageTargetId: string | null;
  readonly preSubmitRows: readonly TextQuestionCheckRow[];
  readonly railContextRows: readonly DefinitionRow[];
  readonly fillStatusRows: readonly DefinitionRow[];
  readonly draftStatusRows: readonly DefinitionRow[];
  readonly aiBudgetRows: readonly DefinitionRow[];
  readonly submitFlowRows: readonly string[];
  readonly privacyRules: readonly string[];
  readonly serviceRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export interface ImageQuestionWorkflowStep {
  readonly id: string;
  readonly semanticKey?: "SELECT" | "CROP" | "UPLOAD" | "OCR";
  readonly ordinalLabel: string;
  readonly title: string;
  readonly statusLabel: string;
}

export interface ImageQuestionCheckRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly completed: boolean;
}

export interface ImageQuestionUpload {
  readonly id: string;
  readonly targetId: string;
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly status: ImageQuestionUploadStatus;
  readonly subjectLabel: string;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fixtureBadgeLabel?: string;
  readonly heroCountLabel: string;
  readonly heroTitle: string;
  readonly heroDescription: string;
  readonly selectionStateLabel: string;
  readonly contextTitle: string;
  readonly contextRows: readonly DefinitionRow[];
  readonly contextNotice: string;
  readonly contextActionLabel: string;
  readonly workflowSteps: readonly ImageQuestionWorkflowStep[];
  readonly selectorTitle: string;
  readonly selectorDescription: string;
  readonly chooseButtonLabel: string;
  readonly captureButtonLabel: string;
  readonly replaceButtonLabel: string;
  readonly clearButtonLabel: string;
  readonly acceptedFormatsLabel: string;
  readonly qualityHint: string;
  readonly cropTitle: string;
  readonly cropDescription: string;
  readonly cropConfirmLabel: string;
  readonly uploadButtonLabel: string;
  readonly uploadDisabledHint: string;
  readonly uploadReadyHint: string;
  readonly uploadUnavailableMessage: string;
  readonly textModeLabel: string;
  readonly returnKnowledgeLabel: string;
  readonly returnHubLabel: string;
  readonly textTargetId: string | null;
  readonly nextOcrTargetId: string | null;
  readonly imageCheckRows: readonly ImageQuestionCheckRow[];
  readonly currentFileRows: readonly DefinitionRow[];
  readonly railContextRows: readonly DefinitionRow[];
  readonly uploadStatusRows: readonly DefinitionRow[];
  readonly fileRuleRows: readonly DefinitionRow[];
  readonly privacyRules: readonly string[];
  readonly nextStepRows: readonly string[];
  readonly serviceRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export interface OcrWorkflowStep {
  readonly id: string;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly completed: boolean;
}

export interface OcrSourceAsset {
  readonly fileName: string;
  readonly fileSizeLabel: string;
  readonly visibilityLabel: string;
  readonly availabilityLabel: string;
  readonly previewLines: readonly string[];
}

export interface OcrSegment {
  readonly id: string;
  readonly ordinalLabel: string;
  readonly recognizedText: string;
  readonly correctedText: string;
  readonly confidenceLabel: string;
  readonly confidencePercent: number;
  readonly confidence: OcrSegmentConfidence;
  readonly statusLabel: string;
  readonly helpText: string;
  readonly confirmed: boolean;
  readonly editable: boolean;
}

export interface OcrConfirmationCheckRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly completed: boolean;
}

export interface OcrConfirmation {
  readonly id: string;
  readonly targetId: string;
  readonly questionDraftId: string;
  readonly assetId: string;
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly status: OcrConfirmationStatus;
  readonly subjectLabel: string;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fixtureBadgeLabel?: string;
  readonly contextTitle: string;
  readonly contextRows: readonly DefinitionRow[];
  readonly contextNotice: string;
  readonly workflowSteps: readonly OcrWorkflowStep[];
  readonly sourceTitle: string;
  readonly sourceAsset: OcrSourceAsset;
  readonly sourceActionLabels: readonly string[];
  readonly segmentTitle: string;
  readonly segmentSummary: string;
  readonly segments: readonly OcrSegment[];
  readonly previewTitle: string;
  readonly lowConfidenceHint: string;
  readonly confirmTitle: string;
  readonly confirmRows: readonly OcrConfirmationCheckRow[];
  readonly primaryActionLabel: string;
  readonly primaryDisabledHint: string;
  readonly primaryReadyHint: string;
  readonly submitUnavailableMessage: string;
  readonly reRecognizeLabel: string;
  readonly returnImageUploadLabel: string;
  readonly textModeLabel: string;
  readonly returnHubLabel: string;
  readonly textTargetId: string | null;
  readonly imageUploadTargetId: string | null;
  readonly nextTutorTargetId: string | null;
  readonly railContextRows: readonly DefinitionRow[];
  readonly ocrSummaryRows: readonly DefinitionRow[];
  readonly pendingSegmentRows: readonly DefinitionRow[];
  readonly imageStatusRows: readonly DefinitionRow[];
  readonly confirmationRules: readonly string[];
  readonly serviceRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export interface TutorSessionStep {
  readonly id: string;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly completed: boolean;
  readonly current: boolean;
  readonly locked: boolean;
  readonly availabilityLabel: string;
}

export interface TutorQuestion {
  readonly title: string;
  readonly text: string;
  readonly contextRows: readonly DefinitionRow[];
  readonly confirmationLabel: string;
  readonly sourceActionLabel: string;
}

export interface TutorCurrentHint {
  readonly ordinalLabel: string;
  readonly title: string;
  readonly promptLines: readonly string[];
  readonly instruction: string;
}

export interface TutorAnswerDraft {
  readonly title: string;
  readonly label: string;
  readonly placeholder: string;
  readonly maxLength: number;
  readonly helperText: string;
}

export interface TutorSession {
  readonly id: string;
  readonly targetId: string;
  readonly tutorSessionId: string;
  readonly questionDraftId: string;
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly status: TutorSessionStatus;
  readonly subjectLabel: string;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fixtureBadgeLabel?: string;
  readonly question: TutorQuestion;
  readonly progressTitle: string;
  readonly steps: readonly TutorSessionStep[];
  readonly currentHint: TutorCurrentHint;
  readonly answerDraft: TutorAnswerDraft;
  readonly lockedTitle: string;
  readonly lockedSteps: readonly TutorSessionStep[];
  readonly unsureLabel: string;
  readonly unsureHint: string;
  readonly basisTitle: string;
  readonly basisRows: readonly DefinitionRow[];
  readonly basisNotice: string;
  readonly primaryActionLabel: string;
  readonly primaryDisabledHint: string;
  readonly primaryReadyHint: string;
  readonly submitUnavailableMessage: string;
  readonly saveExitLabel: string;
  readonly returnQuestionLabel: string;
  readonly viewBasisLabel: string;
  readonly railProgressRows: readonly DefinitionRow[];
  readonly railQuestionRows: readonly DefinitionRow[];
  readonly railHintRows: readonly DefinitionRow[];
  readonly railBasisRows: readonly DefinitionRow[];
  readonly railAiRows: readonly DefinitionRow[];
  readonly railRecoveryRows: readonly DefinitionRow[];
  readonly serviceRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export interface TutorResultConclusionRow {
  readonly id: string;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly conclusion: string;
}

export interface TutorResultTimelineItem {
  readonly id: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly description: string;
  readonly state: TutorResultTimelineState;
}

export interface TutorResult {
  readonly id: string;
  readonly targetId: string;
  readonly tutorSessionId: string;
  readonly questionDraftId: string;
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly status: TutorResultStatus;
  readonly subjectLabel: string;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly completedAtLabel: string;
  readonly fixtureBadgeLabel?: string;
  readonly metricValue: string;
  readonly metricUnitLabel: string;
  readonly formula: string;
  readonly conclusions: readonly TutorResultConclusionRow[];
  readonly evidenceBoundary: string;
  readonly timelineTitle: string;
  readonly timelineItems: readonly TutorResultTimelineItem[];
  readonly nextTitle: string;
  readonly primaryActionLabel: string;
  readonly primaryUnavailableMessage: string;
  readonly returnKnowledgeLabel: string;
  readonly analysisLabel: string;
  readonly reportLabel: string;
  readonly nextSupportCopy: string;
  readonly analysisTitle: string;
  readonly analysisLines: readonly string[];
  readonly reportUnavailableMessage: string;
  readonly reportTypeOptions: readonly string[];
  readonly reportDescriptionPlaceholder: string;
  readonly summaryRows: readonly DefinitionRow[];
  readonly basisRows: readonly DefinitionRow[];
  readonly evidenceRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly sourceBoundary: string;
}

export interface PracticeBoundaryRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface PracticeRecommendation {
  readonly id: string;
  readonly kind: PracticeRecommendationKind;
  readonly ordinalLabel: string;
  readonly badgeLabel: string;
  readonly badgeTone: PracticeRecommendationBadgeTone;
  readonly title: string;
  readonly contextLabel?: string;
  readonly sourceLabel?: string;
  readonly metaLabel: string;
  readonly reason: string;
  readonly statusLabel: string;
  readonly primaryActionLabel: string;
  readonly secondaryActionLabel: string;
  readonly unavailableMessage: string;
  readonly explanationRows: readonly string[];
  readonly sourceRows: readonly DefinitionRow[];
}

export interface PracticeHub {
  readonly id: string;
  readonly targetId: string;
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly status: PracticeHubStatus;
  readonly subjectLabel: string;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly fixtureBadgeLabel?: string;
  readonly metricValue: string;
  readonly metricCaption: string;
  readonly filterEmptyTitle: string;
  readonly filterEmptyDescription: string;
  readonly recommendations: readonly PracticeRecommendation[];
  readonly boundaryRows: readonly PracticeBoundaryRow[];
  readonly estimatedTotalLabel: string;
  readonly returnKnowledgeLabel: string;
  readonly currentKnowledgeRows: readonly DefinitionRow[];
  readonly recommendationBasisRows: readonly DefinitionRow[];
  readonly evidenceRuleRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type PracticeAttemptStatus =
  | "ANSWERING"
  | "QUESTION_UNAVAILABLE"
  | "SUBMISSION_UNKNOWN"
  | "ALREADY_SUBMITTED"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type PracticeAttemptDraftLevel = "LOCAL_SAVED" | "SERVER_SAVED";
export type PracticeAttemptProgressState = "SAVED" | "CURRENT" | "UNANSWERED";

export interface PracticeAttemptProgressItem {
  readonly id: string;
  readonly number: number;
  readonly state: PracticeAttemptProgressState;
  readonly label: string;
}

export type PracticeAttemptFieldKind = "SHORT_TEXT" | "TEXTAREA";

export interface PracticeAttemptField {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly kind: PracticeAttemptFieldKind;
  readonly maxLength?: number;
  readonly inputMode?: "text" | "decimal";
}

export interface PracticeAttempt {
  readonly id: string;
  readonly attemptId: string;
  readonly targetId: string;
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly status: PracticeAttemptStatus;
  readonly draftLevel: PracticeAttemptDraftLevel;
  readonly subjectLabel: string;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly savedAtLabel: string;
  readonly fixtureBadgeLabel?: string;
  readonly currentQuestionNumber: number;
  readonly totalQuestions: number;
  readonly answeredCount: number;
  readonly metricValue: string;
  readonly metricCaption: string;
  readonly questionTypeLabel: string;
  readonly questionTitle: string;
  readonly questionContext: string;
  readonly stem: string;
  readonly noHintNotice: string;
  readonly progressItems: readonly PracticeAttemptProgressItem[];
  readonly fields: readonly PracticeAttemptField[];
  readonly draftStatusLabel: string;
  readonly submitReminder: string;
  readonly previousActionLabel: string;
  readonly submitActionLabel: string;
  readonly exitActionLabel: string;
  readonly submitDialogTitle: string;
  readonly submitDialogDescription: string;
  readonly submitDialogConfirmLabel: string;
  readonly submitDialogCancelLabel: string;
  readonly unknownSubmissionMessage: string;
  readonly returnPracticeHubLabel: string;
  readonly progressRows: readonly DefinitionRow[];
  readonly ruleRows: readonly DefinitionRow[];
  readonly evidenceRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceRows: readonly DefinitionRow[];
  readonly sourceBoundary: string;
}

export type PracticeResultStatus =
  | "LOADING"
  | "ALL_CORRECT_CONFIRMED"
  | "INCORRECT_WRONG_ITEM_CREATED"
  | "INCORRECT_WRONG_ITEM_PENDING"
  | "PARTIALLY_JUDGED"
  | "RESULT_UNKNOWN"
  | "EXPLANATION_FAILED"
  | "OFFLINE_READONLY"
  | "DENIED_AS_NOT_FOUND"
  | "SESSION_EXPIRED";

export type PracticeResultAnswerState = "CORRECT" | "WRONG" | "UNJUDGEABLE" | "EXPLANATION_UNAVAILABLE";

export interface PracticeResultMetric {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly description: string;
}

export interface PracticeResultAnswerItem {
  readonly id: string;
  readonly numberLabel: string;
  readonly title: string;
  readonly state: PracticeResultAnswerState;
  readonly stateLabel: string;
  readonly questionText: string;
  readonly studentAnswer: string;
  readonly confirmedConclusion: string;
  readonly explanation: string;
}

export interface PracticeResultWrongReview {
  readonly id: string;
  readonly detailTargetId?: string;
  readonly wrongItemId: string | null;
  readonly numberLabel: string;
  readonly title: string;
  readonly questionText: string;
  readonly studentAnswer: string;
  readonly correctConclusion: string;
  readonly reason: string;
  readonly explanation: string;
  readonly sourceLabel: string;
  readonly statusLabel: string;
}

export interface PracticeResult {
  readonly id: string;
  readonly attemptId: string;
  readonly targetId: string;
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly status: PracticeResultStatus;
  readonly subjectLabel: string;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly submittedAtLabel: string;
  readonly fixtureBadgeLabel?: string;
  readonly metricValue: string;
  readonly metricCaption: string;
  readonly summaryText: string;
  readonly metrics: readonly PracticeResultMetric[];
  readonly evidenceBoundary: string;
  readonly wrongReview: PracticeResultWrongReview | null;
  readonly correctAnswers: readonly PracticeResultAnswerItem[];
  readonly wrongDetailActionLabel: string;
  readonly analysisActionLabel: string;
  readonly correctToggleLabel: string;
  readonly correctCollapseLabel: string;
  readonly returnPracticeHubLabel: string;
  readonly continueNextLabel: string;
  readonly nextStepNotice: string;
  readonly wrongDetailUnavailableMessage: string;
  readonly continueUnavailableMessage: string;
  readonly submissionRows: readonly DefinitionRow[];
  readonly evidenceRows: readonly DefinitionRow[];
  readonly wrongStatusRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type WrongBookStatus =
  | "LOADING"
  | "WITH_RECORDS"
  | "FIRST_EMPTY"
  | "FILTER_EMPTY"
  | "PARTIAL_EVIDENCE_MISSING"
  | "LIST_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND"
  | "LOADING_MORE"
  | "LOAD_MORE_FAILED";

export type WrongBookFilter = "ALL" | "PENDING_CORRECTION" | "PENDING_REVIEW" | "RECOVERED";

export type WrongBookSubjectFilter = "ALL_SUBJECTS" | SubjectCode;

export type WrongBookSort = "NEXT_ACTION" | "NEWEST" | "SUBJECT";

export type WrongBookItemStatus = "PENDING_CORRECTION" | "PENDING_REVIEW" | "RECOVERED" | "EVIDENCE_MISSING";

export interface WrongBookSubjectOption {
  readonly value: WrongBookSubjectFilter;
  readonly label: string;
}

export interface WrongBookSortOption {
  readonly value: WrongBookSort;
  readonly label: string;
}

export interface WrongBookRecord {
  readonly id: string;
  readonly detailTargetId?: string;
  readonly reviewTargetId?: string;
  readonly wrongItemId: string | null;
  readonly numberLabel: string;
  readonly markerLabel?: string;
  readonly title: string;
  readonly subjectLabel: string;
  readonly scopeLabel: string;
  readonly summary: string;
  readonly sourceLabel: string;
  readonly evidenceLabel: string;
  readonly status: WrongBookItemStatus;
  readonly statusLabel: string;
  readonly nextActionLabel: string;
  readonly timeLabel: string;
  readonly detailActionLabel: string;
}

export interface WrongBookDocument {
  readonly id: string;
  readonly targetId: string;
  readonly status: WrongBookStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly fixtureBadgeLabel?: string;
  readonly totalValue: string;
  readonly totalCaption: string;
  readonly filterCounts: Readonly<Record<WrongBookFilter, number>>;
  readonly subjectOptions: readonly WrongBookSubjectOption[];
  readonly sortOptions: readonly WrongBookSortOption[];
  readonly records: readonly WrongBookRecord[];
  readonly footerStatusLine: string;
  readonly recoveryBoundary: string;
  readonly startActionLabel: string;
  readonly startUnavailableMessage: string;
  readonly detailUnavailableMessage: string;
  readonly loadMoreLabel: string;
  readonly noMoreLabel: string;
  readonly todayRows: readonly DefinitionRow[];
  readonly statusRows: readonly DefinitionRow[];
  readonly evidenceRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type WrongItemDetailStatus =
  | "LOADING"
  | "PENDING_CORRECTION"
  | "CORRECTION_IN_PROGRESS"
  | "PENDING_REVIEW"
  | "REVIEW_DUE"
  | "RECOVERED"
  | "ORIGINAL_ASSET_DELETED"
  | "EVIDENCE_INSUFFICIENT"
  | "DETAIL_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type WrongItemTimelineStageState = "CONFIRMED" | "CURRENT" | "PENDING" | "UNAVAILABLE";

export interface WrongItemTimelineStage {
  readonly id: string;
  readonly label: string;
  readonly state: WrongItemTimelineStageState;
  readonly caption: string;
}

export interface WrongItemDetailDocument {
  readonly id: string;
  readonly targetId: string;
  readonly wrongItemId: string;
  readonly status: WrongItemDetailStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly statusLabel: string;
  readonly questionNumber: string;
  readonly questionNumberCaption: string;
  readonly itemTitle: string;
  readonly scopeLabel: string;
  readonly questionText: string;
  readonly sourceLabel: string;
  readonly originalAnswerLabel: string;
  readonly originalAnswer: string;
  readonly correctAnswerLabel: string;
  readonly correctAnswer: string;
  readonly answerBoundary: string;
  readonly causeRows: readonly DefinitionRow[];
  readonly causeExplanation: string;
  readonly timelineStages: readonly WrongItemTimelineStage[];
  readonly primaryActionLabel: string;
  readonly returnActionLabel: string;
  readonly resultActionLabel: string;
  readonly correctionUnavailableMessage: string;
  readonly correctionTargetId: string;
  readonly submissionUnavailableMessage: string;
  readonly evidenceNotice: string;
  readonly wrongBookTargetId: string;
  readonly practiceResultTargetId: string;
  readonly practiceResultAttemptId: string;
  readonly practiceResultChapterId: string;
  readonly practiceResultKnowledgePointId: string;
  readonly currentStatusRows: readonly DefinitionRow[];
  readonly reliabilityRows: readonly DefinitionRow[];
  readonly sourceRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type WrongItemCorrectionStatus =
  | "LOADING"
  | "ANSWERING"
  | "CAUSE_UNSELECTED"
  | "READY_TO_SUBMIT"
  | "DRAFT_SAVING"
  | "DRAFT_SAVED_LOCAL"
  | "DRAFT_SAVED_SERVER"
  | "SUBMITTING"
  | "CORRECTION_FAILED"
  | "CORRECTION_PASSED_PENDING_REVIEW"
  | "SUBMISSION_UNKNOWN"
  | "DUPLICATE_SUBMISSION"
  | "OFFLINE_DRAFT"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type WrongItemCorrectionStepState = "COMPLETE" | "CURRENT" | "PENDING" | "ERROR";

export interface WrongItemCorrectionStep {
  readonly id: string;
  readonly label: string;
  readonly state: WrongItemCorrectionStepState;
  readonly caption: string;
}

export type WrongItemCorrectionCauseValue =
  | "SIGN_OF_H_IN_VERTEX_FORM"
  | "FORGOT_AXIS_RULE"
  | "CALCULATION_ERROR"
  | "OTHER";

export interface WrongItemCorrectionCauseOption {
  readonly id: string;
  readonly value: WrongItemCorrectionCauseValue;
  readonly label: string;
}

export interface WrongItemCorrectionOriginalRecord {
  readonly originalAnswerLabel: string;
  readonly originalAnswer: string;
  readonly correctAnswerLabel: string;
  readonly correctAnswer: string;
  readonly causeLabel: string;
  readonly causeText: string;
}

export interface WrongItemCorrectionDocument {
  readonly id: string;
  readonly targetId: string;
  readonly wrongItemId: string;
  readonly correctionId: string;
  readonly status: WrongItemCorrectionStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly draftStatusLabel: string;
  readonly largeNumber: string;
  readonly largeNumberCaption: string;
  readonly itemTitle: string;
  readonly scopeLabel: string;
  readonly questionText: string;
  readonly foldedOriginalRecordLabel: string;
  readonly originalRecord: WrongItemCorrectionOriginalRecord;
  readonly answerLabel: string;
  readonly answerValue: string;
  readonly processLabel: string;
  readonly processValue: string;
  readonly processCharLimit: number;
  readonly answerStatusLabel: string;
  readonly causeQuestion: string;
  readonly causeOptions: readonly WrongItemCorrectionCauseOption[];
  readonly selectedCause: WrongItemCorrectionCauseValue;
  readonly causeExplanationLabel: string;
  readonly causeExplanationValue: string;
  readonly causeCharLimit: number;
  readonly privacyNotice: string;
  readonly primaryActionLabel: string;
  readonly returnActionLabel: string;
  readonly saveExitActionLabel: string;
  readonly irreversibleNotice: string;
  readonly evidenceNotice: string;
  readonly submitDialogTitle: string;
  readonly submitDialogDescription: string;
  readonly submitDialogItems: readonly string[];
  readonly submissionUnknownMessage: string;
  readonly saveExitMessage: string;
  readonly detailTargetId: string;
  readonly wrongBookTargetId: string;
  readonly progressSteps: readonly WrongItemCorrectionStep[];
  readonly progressRows: readonly DefinitionRow[];
  readonly evidenceRows: readonly DefinitionRow[];
  readonly ruleRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type ScheduledReviewAttemptStatus =
  | "LOADING"
  | "NOT_DUE"
  | "DUE_ANSWERING"
  | "DRAFT_SAVING"
  | "DRAFT_SAVED_LOCAL"
  | "DRAFT_SAVED_SERVER"
  | "SUBMITTING"
  | "NETWORK_FAILURE_RETRYABLE"
  | "SUBMISSION_UNKNOWN"
  | "ALREADY_COMPLETED"
  | "QUESTION_UNAVAILABLE"
  | "OFFLINE_DRAFT"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type ScheduledReviewEligibilityStepState = "COMPLETE" | "CURRENT" | "PENDING" | "UNAVAILABLE";

export interface ScheduledReviewEligibilityStep {
  readonly id: string;
  readonly label: string;
  readonly caption: string;
  readonly state: ScheduledReviewEligibilityStepState;
}

export type ScheduledReviewAnswerFieldKind = "SHORT_TEXT" | "TEXTAREA";

export interface ScheduledReviewAnswerField {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly kind: ScheduledReviewAnswerFieldKind;
  readonly maxLength?: number;
  readonly inputMode?: "text" | "decimal";
}

export interface ScheduledReviewAttemptDocument {
  readonly id: string;
  readonly targetId: string;
  readonly wrongItemId: string;
  readonly reviewId: string;
  readonly questionId: string;
  readonly status: ScheduledReviewAttemptStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly gateStatusLabel: string;
  readonly draftStatusLabel: string;
  readonly largeNumber: string;
  readonly largeNumberCaption: string;
  readonly questionTitle: string;
  readonly scopeLabel: string;
  readonly variantRelationLabel: string;
  readonly questionText: string;
  readonly protectedHistoryNotice: string;
  readonly noHintNotice: string;
  readonly fields: readonly ScheduledReviewAnswerField[];
  readonly draftStatusLine: string;
  readonly primaryActionLabel: string;
  readonly returnActionLabel: string;
  readonly saveExitActionLabel: string;
  readonly irreversibleNotice: string;
  readonly evidenceNotice: string;
  readonly submitDialogTitle: string;
  readonly submitDialogDescription: string;
  readonly submitDialogItems: readonly string[];
  readonly submissionUnknownMessage: string;
  readonly saveExitMessage: string;
  readonly detailTargetId: string;
  readonly wrongBookTargetId: string;
  readonly eligibilitySteps: readonly ScheduledReviewEligibilityStep[];
  readonly gateRows: readonly DefinitionRow[];
  readonly protectedHistoryRows: readonly DefinitionRow[];
  readonly evidenceRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type ReviewResultStatus =
  | "LOADING"
  | "PASSED_RECOVERED"
  | "FAILED_RESCHEDULED"
  | "PARTIALLY_JUDGED"
  | "MASTERY_EVIDENCE_UPDATED"
  | "MASTERY_UPDATE_PENDING"
  | "RESULT_UNKNOWN"
  | "OFFLINE_READONLY"
  | "DENIED_AS_NOT_FOUND"
  | "SESSION_EXPIRED";

export type ReviewResultMetricSource = "SERVER_CONFIRMED" | "SERVICE_PENDING";

export interface ReviewResultMetric {
  readonly id: string;
  readonly value: string;
  readonly label: string;
  readonly source: ReviewResultMetricSource;
}

export type ReviewResultAnswerJudgement = "CORRECT" | "WRONG" | "UNJUDGEABLE";

export interface ReviewResultAnswerRow {
  readonly id: string;
  readonly label: string;
  readonly answer: string;
  readonly judgement: ReviewResultAnswerJudgement;
  readonly judgementLabel: string;
}

export interface ReviewResultReason {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export type ReviewResultTimelineState = "COMPLETE" | "CURRENT" | "PENDING" | "UNAVAILABLE";

export interface ReviewResultTimelineStage {
  readonly id: string;
  readonly label: string;
  readonly caption: string;
  readonly state: ReviewResultTimelineState;
}

export interface ReviewResultDocument {
  readonly id: string;
  readonly targetId: string;
  readonly wrongItemId: string;
  readonly reviewId: string;
  readonly knowledgePointId: string;
  readonly status: ReviewResultStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly resultStatusLabel: string;
  readonly largeNumber: string;
  readonly largeNumberCaption: string;
  readonly summaryText: string;
  readonly metrics: readonly ReviewResultMetric[];
  readonly evidenceBoundary: string;
  readonly answerSectionTitle: string;
  readonly answerTopicTitle: string;
  readonly answerQuestionText: string;
  readonly answerPrompt: string;
  readonly answerRows: readonly ReviewResultAnswerRow[];
  readonly analysisText: string;
  readonly answerSourceLabel: string;
  readonly recoveryReasonTitle: string;
  readonly recoveryReasons: readonly ReviewResultReason[];
  readonly recoveryReasonSummary: string;
  readonly timelineTitle: string;
  readonly timelineStages: readonly ReviewResultTimelineStage[];
  readonly primaryActionLabel: string;
  readonly wrongBookActionLabel: string;
  readonly continueActionLabel: string;
  readonly nextStepNotice: string;
  readonly wrongBookTargetId: string;
  readonly knowledgeEvidenceTargetId: string;
  readonly nextRecommendedTargetId?: string;
  readonly resultRows: readonly DefinitionRow[];
  readonly wrongStatusRows: readonly DefinitionRow[];
  readonly masteryImpactRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly unknownMessage: string;
  readonly continueFallbackMessage: string;
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type ExamListStatus =
  | "LOADING"
  | "WITH_RECORDS"
  | "FIRST_EMPTY"
  | "FILTER_EMPTY"
  | "ENTRY_INCOMPLETE"
  | "ANALYSIS_PENDING"
  | "ANALYSIS_FAILED"
  | "LIST_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND"
  | "LOADING_MORE"
  | "LOAD_MORE_FAILED";

export type ExamListFilter = "ALL" | "COMPLETE" | "INCOMPLETE" | "ANALYSIS_PENDING";

export type ExamListSubjectFilter = "ALL_SUBJECTS" | SubjectCode;

export type ExamListSort = "EXAM_DATE_DESC" | "EXAM_DATE_ASC" | "SUBJECT";

export type ExamRecordStatus = "COMPLETE" | "INCOMPLETE" | "ANALYSIS_PENDING";

export type ExamAnalysisStatus = "AVAILABLE" | "UNAVAILABLE" | "PENDING" | "FAILED";

export interface ExamListSubjectOption {
  readonly value: ExamListSubjectFilter;
  readonly label: string;
}

export interface ExamListSortOption {
  readonly value: ExamListSort;
  readonly label: string;
}

export interface ExamRecord {
  readonly id: string;
  readonly examId: string | null;
  readonly numberLabel: string;
  readonly status: ExamRecordStatus;
  readonly statusLabel: string;
  readonly title: string;
  readonly subjectLabel: string;
  readonly typeLabel: string;
  readonly dateLabel: string;
  readonly rawScoreLabel: string;
  readonly scoreSourceLabel: string;
  readonly lossLabel: string;
  readonly lossItemsLabel: string;
  readonly lossItemsDetailLabel?: string;
  readonly analysisStatus: ExamAnalysisStatus;
  readonly analysisLabel: string;
  readonly actionLabel: string;
  readonly detailTargetId?: string;
  readonly entryTargetId?: string;
}

export interface ExamListDocument {
  readonly id: string;
  readonly targetId: string;
  readonly status: ExamListStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly totalValue: string;
  readonly totalCaption: string;
  readonly filterCounts: Readonly<Record<ExamListFilter, number>>;
  readonly subjectOptions: readonly ExamListSubjectOption[];
  readonly sortOptions: readonly ExamListSortOption[];
  readonly records: readonly ExamRecord[];
  readonly footerStatusLine: string;
  readonly factBoundary: string;
  readonly newActionLabel: string;
  readonly newEntryTargetId: string;
  readonly focusActionLabel: string;
  readonly focusExamId: string | null;
  readonly newExamUnavailableMessage: string;
  readonly detailUnavailableMessage: string;
  readonly entryUnavailableMessage: string;
  readonly noMoreLabel: string;
  readonly todayRows: readonly DefinitionRow[];
  readonly inputScopeRows: readonly DefinitionRow[];
  readonly analysisRuleRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type ExamEntryStatus =
  | "LOADING"
  | "DEFAULT_EMPTY"
  | "DRAFT_PARTIAL"
  | "VALIDATION_ERROR"
  | "READY_TO_SAVE"
  | "DRAFT_SAVING"
  | "DRAFT_SAVED_LOCAL"
  | "DRAFT_SAVED_SERVER"
  | "SUBMITTING"
  | "RESULT_UNKNOWN"
  | "DUPLICATE_REQUEST"
  | "OFFLINE_DRAFT"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type ExamEntryStepState = "COMPLETE" | "CURRENT" | "PENDING" | "ERROR";

export interface ExamEntryStep {
  readonly id: string;
  readonly label: string;
  readonly state: ExamEntryStepState;
  readonly caption: string;
}

export interface ExamLossItemDraft {
  readonly id: string;
  readonly questionNumber: string;
  readonly lossScore: string;
  readonly scopeLabel: string;
  readonly reasonLabel: string;
  readonly confirmed: boolean;
}

export interface ExamEntryDocument {
  readonly id: string;
  readonly targetId: string;
  readonly examId: string | null;
  readonly status: ExamEntryStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly draftStatusLabel: string;
  readonly fixtureBadgeLabel?: string;
  readonly largeNumber: string;
  readonly largeNumberCaption: string;
  readonly factsTitle: string;
  readonly examName: string;
  readonly subjectLabel: string;
  readonly examTypeLabel: string;
  readonly examDate: string;
  readonly scopeLabel: string;
  readonly textbookAlignmentLabel: string;
  readonly earnedScore: string;
  readonly maximumScore: string;
  readonly scoreScaleNotice: string;
  readonly steps: readonly ExamEntryStep[];
  readonly lossItems: readonly ExamLossItemDraft[];
  readonly noteValue: string;
  readonly noteCharLimit: number;
  readonly primaryActionLabel: string;
  readonly saveDraftActionLabel: string;
  readonly cancelActionLabel: string;
  readonly saveNotice: string;
  readonly scopeNotice: string;
  readonly saveDialogTitle: string;
  readonly saveDialogDescription: string;
  readonly saveDialogItems: readonly string[];
  readonly saveUnknownMessage: string;
  readonly draftReturnMessage: string;
  readonly listTargetId: string;
  readonly detailTargetId: string | null;
  readonly completenessRows: readonly DefinitionRow[];
  readonly scoreRows: readonly DefinitionRow[];
  readonly scopeRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type ExamDetailStatus =
  | "LOADING"
  | "COMPLETE_ANALYSIS_AVAILABLE"
  | "PARTIAL_ENTRY"
  | "NO_LOSS_ITEMS"
  | "ANALYSIS_PENDING"
  | "ANALYSIS_FAILED"
  | "ANALYSIS_STALE"
  | "EDITING"
  | "EDIT_CONFLICT"
  | "DETAIL_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export interface ExamDetailMetric {
  readonly id: string;
  readonly value: string;
  readonly label: string;
}

export interface ExamDetailLossItem {
  readonly id: string;
  readonly questionNumber: string;
  readonly lossScore: string;
  readonly scopeLabel: string;
  readonly reasonLabel: string;
  readonly evidenceStatusLabel: string;
}

export interface ExamDetailDocument {
  readonly id: string;
  readonly targetId: string;
  readonly examId: string | null;
  readonly analysisId: string | null;
  readonly analysisTargetId: string | null;
  readonly status: ExamDetailStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly updateStatusLabel: string;
  readonly examName: string;
  readonly subjectTypeLabel: string;
  readonly examDateLabel: string;
  readonly scopeLabel: string;
  readonly textbookAlignmentLabel: string;
  readonly rawScore: string;
  readonly maximumScore: string;
  readonly scoreCaption: string;
  readonly scoreAriaLabel: string;
  readonly scoreNotice: string;
  readonly metrics: readonly ExamDetailMetric[];
  readonly lossItems: readonly ExamDetailLossItem[];
  readonly lossSumExpression: string;
  readonly lossConsistencyLabel: string;
  readonly editActionLabel: string;
  readonly editPanelTitle: string;
  readonly editPanelDescription: string;
  readonly versionLabel: string;
  readonly expectedVersionLabel: string;
  readonly editSaveUnknownMessage: string;
  readonly analysisStatusTitle: string;
  readonly analysisStatusLabel: string;
  readonly analysisBasisLabel: string;
  readonly analysisGeneratedAtLabel: string;
  readonly analysisReliabilityLabel: string;
  readonly primaryActionLabel: string;
  readonly analysisBoundaryMessage: string;
  readonly listActionLabel: string;
  readonly listTargetId: string;
  readonly scopeNotice: string;
  readonly recordStatusRows: readonly DefinitionRow[];
  readonly completenessRows: readonly DefinitionRow[];
  readonly analysisRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type ExamAnalysisDocumentStatus =
  | "LOADING"
  | "ANALYSIS_AVAILABLE"
  | "DATA_INSUFFICIENT"
  | "RESULT_UNKNOWN"
  | "GENERATION_FAILED"
  | "EVIDENCE_UNAVAILABLE"
  | "ANALYSIS_STALE"
  | "PLAN_PENDING"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export interface ExamAnalysisAttribution {
  readonly id: string;
  readonly sourceLossItemId: string;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly questionLabel: string;
  readonly lossScore: number;
  readonly lossLabel: string;
  readonly causeLabel: string;
  readonly sourceLabel: string;
  readonly reliabilityLabel: string;
  readonly rawMagnitudePercent: number;
}

export interface ExamAnalysisRemediationStep {
  readonly id: string;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly durationLabel: string;
  readonly reason: string;
  readonly actionPath: string;
}

export interface ExamAnalysisDocument {
  readonly id: string;
  readonly targetId: string;
  readonly examId: string | null;
  readonly analysisId: string | null;
  readonly examVersion: string;
  readonly planId: string | null;
  readonly remediationPlanTargetId: string | null;
  readonly status: ExamAnalysisDocumentStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly generatedAtLabel: string;
  readonly generationStatusLabel: string;
  readonly examName: string;
  readonly rawScore: string;
  readonly maximumScore: string;
  readonly totalLoss: string;
  readonly confirmedLossItemsLabel: string;
  readonly largeNumber: string;
  readonly largeNumberCaption: string;
  readonly attributionTitle: string;
  readonly attributions: readonly ExamAnalysisAttribution[];
  readonly coverageStatement: string;
  readonly dataBoundaryStatement: string;
  readonly remediationTitle: string;
  readonly remediationSteps: readonly ExamAnalysisRemediationStep[];
  readonly remediationTotalLabel: string;
  readonly primaryActionLabel: string;
  readonly returnDetailActionLabel: string;
  readonly lossItemsActionLabel: string;
  readonly remediationBoundaryMessage: string;
  readonly lossItemsDisclosureTitle: string;
  readonly detailTargetId: string;
  readonly listTargetId: string;
  readonly sourceRows: readonly DefinitionRow[];
  readonly reliabilityRows: readonly DefinitionRow[];
  readonly dataBoundaryRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type RemediationPlanDocumentStatus =
  | "LOADING"
  | "EXECUTABLE"
  | "PARTIALLY_COMPLETED"
  | "COMPLETED"
  | "DATA_CHANGED_RECALCULATING"
  | "GENERATION_FAILED"
  | "BASIS_INSUFFICIENT"
  | "TASK_STARTING"
  | "TASK_RESUME_AVAILABLE"
  | "START_RESULT_UNKNOWN"
  | "PLAN_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type RemediationTaskPathState = "COMPLETED" | "CURRENT" | "PENDING" | "LOCKED" | "UNAVAILABLE";

export interface RemediationPlanSummaryMetric {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export interface RemediationPlanSubstep {
  readonly id: string;
  readonly title: string;
  readonly durationLabel: string;
  readonly description: string;
}

export interface RemediationPlanCurrentTask {
  readonly taskId: string;
  readonly title: string;
  readonly durationLabel: string;
  readonly sourceLabel: string;
  readonly rationale: string;
  readonly substeps: readonly RemediationPlanSubstep[];
  readonly evidenceStateLabel: string;
  readonly targetType: string;
  readonly targetLabel: string;
  readonly routeToken: string;
}

export interface RemediationPlanTaskPathItem {
  readonly id: string;
  readonly ordinalLabel: string;
  readonly title: string;
  readonly sourceLabel: string;
  readonly state: RemediationTaskPathState;
  readonly statusLabel: string;
  readonly durationLabel: string;
  readonly completionLabel: string;
}

export interface RemediationPlanDocument {
  readonly id: string;
  readonly targetId: string;
  readonly examId: string | null;
  readonly analysisId: string | null;
  readonly planId: string | null;
  readonly examVersion: string;
  readonly analysisVersion: string;
  readonly planVersion: string;
  readonly status: RemediationPlanDocumentStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly planStatusLabel: string;
  readonly progressPercent: number;
  readonly summaryMetrics: readonly RemediationPlanSummaryMetric[];
  readonly largeNumber: string;
  readonly largeNumberCaption: string;
  readonly currentTaskTitle: string;
  readonly currentTask: RemediationPlanCurrentTask;
  readonly primaryActionLabel: string;
  readonly secondaryActionLabel: string;
  readonly startUnknownMessage: string;
  readonly taskExplanationTitle: string;
  readonly taskExplanation: string;
  readonly taskBoundaryNotice: string;
  readonly pathTitle: string;
  readonly taskPath: readonly RemediationPlanTaskPathItem[];
  readonly basisTitle: string;
  readonly basisRows: readonly DefinitionRow[];
  readonly basisBoundary: string;
  readonly returnAnalysisActionLabel: string;
  readonly detailActionLabel: string;
  readonly completionFlowNotice: string;
  readonly analysisTargetId: string;
  readonly detailTargetId: string;
  readonly statusRows: readonly DefinitionRow[];
  readonly currentBasisRows: readonly DefinitionRow[];
  readonly recalculationRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type MasteryOverviewDocumentStatus =
  | "LOADING"
  | "WITH_EVIDENCE"
  | "FIRST_OR_INSUFFICIENT"
  | "COVERAGE_INCOMPLETE"
  | "UPDATING"
  | "FILTER_EMPTY"
  | "OVERVIEW_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND"
  | "LOADING_MORE"
  | "LOAD_MORE_FAILED";

export type MasteryOverviewFilterKey = "ALL" | "SUFFICIENT" | "OBSERVE" | "INSUFFICIENT";

export type MasteryJudgmentKey =
  | "SUFFICIENT"
  | "OBSERVE"
  | "INSUFFICIENT"
  | "PENDING"
  | "CONFLICTED"
  | "UNKNOWN";

export interface MasteryOverviewFilter {
  readonly id: MasteryOverviewFilterKey;
  readonly label: string;
  readonly count: number;
}

export interface MasteryEvidenceRow {
  readonly id: string;
  readonly ordinalLabel: string;
  readonly knowledgePointId: string;
  readonly detailTargetId: string;
  readonly title: string;
  readonly judgment: MasteryJudgmentKey;
  readonly judgmentLabel: string;
  readonly evidenceSummary: string;
  readonly coverageLabel: string;
  readonly recentEvidenceLabel: string;
  readonly rationale: string;
  readonly actionLabel: string;
}

export interface MasteryOverviewDocument {
  readonly id: string;
  readonly targetId: string;
  readonly snapshotVersion: string;
  readonly status: MasteryOverviewDocumentStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly updateStatusLabel: string;
  readonly chapterLabel: string;
  readonly subjectFilterLabel: string;
  readonly evidencePeriodFilterLabel: string;
  readonly largeNumber: string;
  readonly largeNumberCaption: string;
  readonly filters: readonly MasteryOverviewFilter[];
  readonly rows: readonly MasteryEvidenceRow[];
  readonly coveragePeriodLabel: string;
  readonly phaseNotice: string;
  readonly coverageRows: readonly DefinitionRow[];
  readonly judgmentRows: readonly DefinitionRow[];
  readonly sourceRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type MasteryDetailDocumentStatus =
  | "LOADING"
  | "EVIDENCE_SUFFICIENT"
  | "EVIDENCE_INSUFFICIENT"
  | "EVIDENCE_CONFLICTED"
  | "NEW_EVIDENCE_PENDING"
  | "NOT_APPLICABLE_FOR_GRADE"
  | "DETAIL_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type MasteryDetailEvidenceEffect = "SUPPORT" | "CONFLICT" | "REPAIR" | "PENDING" | "NEUTRAL";

export interface MasteryDetailMetric {
  readonly id: string;
  readonly value: string;
  readonly label: string;
}

export interface MasteryDetailSourceObject {
  readonly id: string;
  readonly sourceObjectId: string;
  readonly title: string;
  readonly rows: readonly DefinitionRow[];
  readonly privacyNotice: string;
}

export interface MasteryDetailEvidenceEvent {
  readonly id: string;
  readonly sourceObjectId: string;
  readonly sourceType: string;
  readonly sourceTypeLabel: string;
  readonly occurredAtLabel: string;
  readonly resultLabel: string;
  readonly detail: string;
  readonly detailAriaLabel: string;
  readonly effect: MasteryDetailEvidenceEffect;
  readonly effectLabel: string;
  readonly reliabilityLabel: string;
  readonly independentLabel: string;
  readonly validForMasteryLabel: string;
  readonly actionLabel: string;
  readonly sourcePreview: MasteryDetailSourceObject;
}

export interface MasteryDetailLearningTargetMapping {
  readonly chapterId: string;
  readonly knowledgePointId: string;
  readonly routeToken: string;
}

export interface MasteryDetailWrongItemTargetMapping {
  readonly targetId: string;
  readonly wrongItemId: string;
  readonly routeToken: string;
}

export interface MasteryDetailSuggestedAction {
  readonly title: string;
  readonly meta: string;
  readonly primaryActionLabel: string;
  readonly primaryTargetMapping: MasteryDetailLearningTargetMapping | null;
  readonly secondaryActionLabel: string;
  readonly overviewTargetId: string;
  readonly relatedActionLabel: string;
  readonly relatedWrongItemTargetMapping: MasteryDetailWrongItemTargetMapping | null;
  readonly targetMappingNotice: string;
}

export interface MasteryDetailDocument {
  readonly id: string;
  readonly targetId: string;
  readonly knowledgePointId: string;
  readonly snapshotVersion: string;
  readonly status: MasteryDetailDocumentStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly updateStatusLabel: string;
  readonly largeNumber: string;
  readonly largeNumberCaption: string;
  readonly judgment: MasteryJudgmentKey;
  readonly judgmentLabel: string;
  readonly rationale: string;
  readonly metrics: readonly MasteryDetailMetric[];
  readonly boundaryNotice: string;
  readonly evidenceRows: readonly MasteryDetailEvidenceEvent[];
  readonly observationRows: readonly DefinitionRow[];
  readonly observationConclusion: string;
  readonly suggestedAction: MasteryDetailSuggestedAction;
  readonly summaryRows: readonly DefinitionRow[];
  readonly compositionRows: readonly DefinitionRow[];
  readonly reliabilityRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type StudentProfileStatus =
  | "LOADING"
  | "NORMAL"
  | "UNCONFIGURED"
  | "SUSPECTED_ERROR_PENDING_REVIEW"
  | "SAVING"
  | "SAVE_SUCCESS"
  | "SAVE_FAILURE"
  | "CORRECTION_SUBMITTING"
  | "CORRECTION_SUCCESS"
  | "CORRECTION_FAILURE"
  | "CORRECTION_UNKNOWN"
  | "DELETE_REQUEST_PENDING"
  | "DELETE_REQUEST_COMPLETED"
  | "DELETE_REQUEST_FAILED"
  | "ACCOUNT_DISABLED"
  | "PROFILE_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type StudentProfileFieldPermission = "SELF_SERVICE" | "CONTROLLED" | "READ_ONLY" | "PENDING_VERIFICATION";

export type StudentProfileSettingKind = "TEXTBOOKS" | "STUDY_TIME" | "FAMILY_PRIVACY";

export interface StudentProfileSelfServiceField {
  readonly id: "displayName" | "personalMotto";
  readonly label: string;
  readonly value: string;
  readonly helperText: string;
  readonly maxLength: number;
  readonly permission: StudentProfileFieldPermission;
}

export interface StudentProfileSettingEntry {
  readonly id: StudentProfileSettingKind;
  readonly title: string;
  readonly summary: string;
  readonly statusLabel: string;
  readonly actionLabel: string;
  readonly route: string;
  readonly boundaryMessage: string;
}

export interface StudentProfileAccountAction {
  readonly id: string;
  readonly title: string;
  readonly actionLabel: string;
  readonly route: string;
  readonly boundaryMessage: string;
}

export interface StudentProfileDocument {
  readonly id: string;
  readonly targetId: string;
  readonly status: StudentProfileStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly loadedAtLabel: string;
  readonly loadStatusLabel: string;
  readonly avatarGlyph: string;
  readonly avatarCaption: string;
  readonly selfServiceTitle: string;
  readonly selfServiceStatusLabel: string;
  readonly selfServiceFields: readonly StudentProfileSelfServiceField[];
  readonly saveActionLabel: string;
  readonly saveOperationUnknownMessage: string;
  readonly controlledTitle: string;
  readonly controlledRows: readonly DefinitionRow[];
  readonly controlledPermissionNotice: string;
  readonly correctionActionLabel: string;
  readonly correctionTitle: string;
  readonly correctionDescription: string;
  readonly correctionUnknownMessage: string;
  readonly settingsTitle: string;
  readonly settings: readonly StudentProfileSettingEntry[];
  readonly accountActions: readonly StudentProfileAccountAction[];
  readonly accountActionsNotice: string;
  readonly accountStatusRows: readonly DefinitionRow[];
  readonly fieldPermissionRows: readonly DefinitionRow[];
  readonly configurationRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type TextbookSettingsDocumentStatus =
  | "LOADING"
  | "MIXED_STATUS"
  | "ALL_CONFIRMED"
  | "GENERIC_GUIDANCE"
  | "PENDING_VERIFICATION"
  | "RETURNED_UNCLEAR"
  | "UPLOADING"
  | "SAVE_FAILURE"
  | "OFFLINE_PENDING_NOT_UPLOADED"
  | "SETTINGS_UNAVAILABLE"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type TextbookSettingsSubjectStatus = "CONFIRMED" | "PENDING" | "GENERIC" | "RETURNED";

export type TextbookVerificationMaterialPurpose = "COVER" | "CATALOG";

export type TextbookVerificationMaterialUploadStatus = "UPLOADED" | "LOCAL_ONLY" | "VALIDATING" | "FAILED";

export type TextbookSettingsActionKind = "VIEW_MATERIALS" | "VIEW_CONFIRMATION" | "SUBMIT_MATERIALS";

export interface TextbookSettingsMetric {
  readonly id: string;
  readonly value: string;
  readonly label: string;
}

export interface TextbookVerificationMaterial {
  readonly id: string;
  readonly assetId: string;
  readonly fileName: string;
  readonly purpose: TextbookVerificationMaterialPurpose;
  readonly purposeLabel: string;
  readonly uploadStatus: TextbookVerificationMaterialUploadStatus;
  readonly uploadStatusLabel: string;
  readonly fileSizeLabel: string;
  readonly mimeLabel: string;
  readonly uploadedAtLabel: string;
}

export interface TextbookSettingsSubjectRow {
  readonly id: string;
  readonly subjectCode: SubjectCode;
  readonly subjectLabel: string;
  readonly status: TextbookSettingsSubjectStatus;
  readonly statusLabel: string;
  readonly textbookLabel: string;
  readonly materialOrTimeLabel: string;
  readonly scopeLabel: string;
  readonly note: string;
  readonly materials: readonly TextbookVerificationMaterial[];
  readonly primaryActionLabel: string;
  readonly primaryActionKind: TextbookSettingsActionKind;
  readonly secondaryActionLabel?: string;
}

export interface TextbookSettingsDocument {
  readonly id: string;
  readonly targetId: string;
  readonly status: TextbookSettingsDocumentStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly updateStatusLabel: string;
  readonly enabledSubjectCount: string;
  readonly enabledSubjectCaption: string;
  readonly metrics: readonly TextbookSettingsMetric[];
  readonly permissionNotice: string;
  readonly subjects: readonly TextbookSettingsSubjectRow[];
  readonly footerSummary: string;
  readonly footerNotice: string;
  readonly materialPurposeTitle: string;
  readonly materialPurposeRows: readonly DefinitionRow[];
  readonly statusOverviewRows: readonly DefinitionRow[];
  readonly verificationRuleRows: readonly string[];
  readonly materialRequirementRows: readonly string[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly materialPanelNotice: string;
  readonly confirmationPanelNotice: string;
  readonly uploadPanelTitle: string;
  readonly uploadPanelDescription: string;
  readonly uploadCoverLabel: string;
  readonly uploadCatalogLabel: string;
  readonly uploadConstraintRows: readonly string[];
  readonly submitVerificationLabel: string;
  readonly verificationOperationUnknownMessage: string;
  readonly localFileNotice: string;
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type StudyTimePreferencesDocumentStatus =
  | "LOADING"
  | "FIRST_DEFAULT"
  | "CUSTOMIZED"
  | "VALIDATION_ERROR"
  | "SAVING"
  | "SAVE_SUCCESS"
  | "SAVE_FAILURE"
  | "TODAY_TASK_CONFLICT"
  | "VERSION_CONFLICT"
  | "SETTINGS_UNAVAILABLE"
  | "OFFLINE_DRAFT"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type StudyTimeScheduleGroupKind = "WEEKDAY" | "WEEKEND";

export type StudyTimeOrderPolicy = "DUE_FIRST_THEN_ESTIMATE";

export interface StudyTimeScheduleGroup {
  readonly id: string;
  readonly kind: StudyTimeScheduleGroupKind;
  readonly label: string;
  readonly daySetLabel: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationHint: string;
}

export interface StudyTimePreviewItem {
  readonly id: string;
  readonly timeRange: string;
  readonly title: string;
  readonly durationLabel: string;
}

export interface StudyTimePreferencesDocument {
  readonly id: string;
  readonly targetId: string;
  readonly status: StudyTimePreferencesDocumentStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly updateStatusLabel: string;
  readonly largeNumber: string;
  readonly largeNumberCaption: string;
  readonly scheduleTitle: string;
  readonly timezoneLabel: string;
  readonly timezoneDescription: string;
  readonly scheduleGroups: readonly StudyTimeScheduleGroup[];
  readonly arrangementTitle: string;
  readonly sessionDurationMinutes: number;
  readonly reminderLeadMinutes: number;
  readonly orderPolicy: StudyTimeOrderPolicy;
  readonly orderPolicyLabel: string;
  readonly showDueOutsideWindow: boolean;
  readonly showDueOutsideWindowLabel: string;
  readonly settingsNotice: string;
  readonly conflictTitle: string;
  readonly currentTimeLabel: string;
  readonly weekendWindowEndLabel: string;
  readonly remainingMinutes: number;
  readonly taskEstimateMinutes: number;
  readonly conflictResolution: string;
  readonly previewRows: readonly StudyTimePreviewItem[];
  readonly previewFooter: string;
  readonly saveActionLabel: string;
  readonly restoreActionLabel: string;
  readonly backActionLabel: string;
  readonly backUrl: string;
  readonly actionBoundary: string;
  readonly statusRows: readonly DefinitionRow[];
  readonly purposeRows: readonly string[];
  readonly conflictRows: readonly DefinitionRow[];
  readonly privacyRows: readonly DefinitionRow[];
  readonly saveOperationUnknownMessage: string;
  readonly restoreConfirmMessage: string;
  readonly dueVisibilityWarning: string;
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export type FamilyPrivacyDocumentStatus =
  | "LOADING"
  | "RELATIONSHIP_READONLY"
  | "ASSET_LIST_EMPTY"
  | "ASSET_LIST_WITH_DATA"
  | "DELETE_CONFIRMING"
  | "DELETE_PENDING"
  | "DELETE_COMPLETED"
  | "DELETE_FAILED"
  | "DELETE_UNKNOWN"
  | "ACCOUNT_PROCESSING_REQUEST"
  | "ACCOUNT_PROCESSING_COMPLETED"
  | "SETTINGS_UNAVAILABLE"
  | "OFFLINE_READONLY"
  | "SESSION_EXPIRED"
  | "DENIED_AS_NOT_FOUND";

export type FamilyPrivateAssetKind = "PRIVATE_QUESTION_IMAGE" | "TUTOR_SESSION";

export type FamilyPrivateAssetDeletionState =
  | "IDLE"
  | "CONFIRMING"
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "UNKNOWN";

export interface FamilyRelationshipRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export interface FamilyPrivateAssetRow {
  readonly id: string;
  readonly assetId: string;
  readonly kind: FamilyPrivateAssetKind;
  readonly name: string;
  readonly typeLabel: string;
  readonly createdAtLabel: string;
  readonly usageLabel: string;
  readonly visibilityLabel: string;
  readonly deletionState: FamilyPrivateAssetDeletionState;
  readonly deleteActionLabel: string;
  readonly confirmTitle: string;
  readonly confirmDescription: string;
  readonly confirmItems: readonly string[];
  readonly pendingMessage: string;
  readonly failedMessage: string;
  readonly unknownMessage: string;
}

export interface FamilyPrivacyDocument {
  readonly id: string;
  readonly targetId: string;
  readonly status: FamilyPrivacyDocumentStatus;
  readonly breadcrumbLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly updatedAtLabel: string;
  readonly updateStatusLabel: string;
  readonly largeNumber: string;
  readonly largeNumberCaption: string;
  readonly relationshipTitle: string;
  readonly relationshipRows: readonly FamilyRelationshipRow[];
  readonly relationshipBoundary: string;
  readonly visibilityTitle: string;
  readonly familyVisibleTitle: string;
  readonly familyVisibleRows: readonly string[];
  readonly privateByDefaultTitle: string;
  readonly privateByDefaultRows: readonly string[];
  readonly visibilityBoundary: string;
  readonly privateDataTitle: string;
  readonly privateAssets: readonly FamilyPrivateAssetRow[];
  readonly privateDataSummary: string;
  readonly deleteNotice: string;
  readonly dataProcessingTitle: string;
  readonly dataProcessingDescription: string;
  readonly manageDataActionLabel: string;
  readonly backActionLabel: string;
  readonly privacyExplanationActionLabel: string;
  readonly backUrl: string;
  readonly accountBoundary: string;
  readonly manageDataRequestTitle: string;
  readonly manageDataRequestDescription: string;
  readonly manageDataRequestRows: readonly string[];
  readonly accountRequestUnknownMessage: string;
  readonly relationStatusRows: readonly DefinitionRow[];
  readonly privateDataRows: readonly DefinitionRow[];
  readonly deletionRuleRows: readonly string[];
  readonly securityRows: readonly string[];
  readonly serviceCode: string;
  readonly sourceBoundary: string;
}

export interface CourseSummary {
  readonly id: string;
  readonly subjectCode: SubjectCode;
  readonly subjectLabel: string;
  readonly grade: Grade;
  readonly term: Term;
  readonly textbookStatus: "CONFIRMED" | "GENERAL_GUIDANCE";
  readonly textbookLabel: string;
  readonly currentPosition: string;
  readonly currentChapter: string;
  readonly progressLabel: string;
  readonly progressPercent: number;
  readonly subjectDetail?: SubjectDetail;
  readonly textbookDetail?: TextbookDetail;
  readonly chapterDetails?: readonly ChapterDetail[];
  readonly knowledgePointDetails?: readonly KnowledgePointDetail[];
  readonly questionHubs?: readonly QuestionHub[];
  readonly textQuestionComposers?: readonly TextQuestionComposer[];
  readonly imageQuestionUploads?: readonly ImageQuestionUpload[];
  readonly ocrConfirmations?: readonly OcrConfirmation[];
  readonly tutorSessions?: readonly TutorSession[];
  readonly tutorResults?: readonly TutorResult[];
  readonly practiceHubs?: readonly PracticeHub[];
  readonly practiceAttempts?: readonly PracticeAttempt[];
  readonly practiceResults?: readonly PracticeResult[];
  readonly wrongBooks?: readonly WrongBookDocument[];
  readonly wrongItemDetails?: readonly WrongItemDetailDocument[];
  readonly wrongItemCorrections?: readonly WrongItemCorrectionDocument[];
  readonly scheduledReviewAttempts?: readonly ScheduledReviewAttemptDocument[];
  readonly reviewResults?: readonly ReviewResultDocument[];
  readonly examLists?: readonly ExamListDocument[];
  readonly examEntries?: readonly ExamEntryDocument[];
  readonly examDetails?: readonly ExamDetailDocument[];
  readonly examAnalyses?: readonly ExamAnalysisDocument[];
  readonly remediationPlans?: readonly RemediationPlanDocument[];
  readonly masteryOverviews?: readonly MasteryOverviewDocument[];
  readonly masteryDetails?: readonly MasteryDetailDocument[];
  readonly studentProfiles?: readonly StudentProfileDocument[];
  readonly textbookSettings?: readonly TextbookSettingsDocument[];
  readonly studyTimePreferences?: readonly StudyTimePreferencesDocument[];
  readonly familyPrivacy?: readonly FamilyPrivacyDocument[];
}

export interface RecentMaterial {
  readonly id: string;
  readonly title: string;
  readonly materialType: MaterialType;
  readonly materialTypeLabel: string;
  readonly subjectCode: SubjectCode;
  readonly usedAt: string;
}

export interface TextbookMetadata {
  readonly publisher: string;
  readonly gradeLabel: string;
  readonly termLabel: string;
  readonly materialTypesLabel: string;
}

export interface MaterialTypeCount {
  readonly materialType: MaterialType;
  readonly label: string;
  readonly count: number;
}

export interface CourseCatalog {
  readonly source: "API" | "DEVELOPMENT_FIXTURE";
  readonly generatedAt: string;
  readonly courses: readonly CourseSummary[];
  readonly recentMaterials: readonly RecentMaterial[];
  readonly textbookMetadata: TextbookMetadata;
  readonly materialTypeCounts: readonly MaterialTypeCount[];
}

export type CourseCatalogResult =
  | { readonly status: "ready"; readonly catalog: CourseCatalog }
  | {
      readonly status: "unavailable";
      readonly reason: "NOT_AUTHENTICATED" | "STUDENT_ROLE_REQUIRED" | "COURSE_SERVICE_UNAVAILABLE";
    };
