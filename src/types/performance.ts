export interface TopicPerformance {
    topic: string;
    total_available: number;
    answered: number;
    correct: number;
    accuracy: number;
    status: 'Ignored' | 'Strong' | 'Weak' | 'Average';
}

export interface SpecialtyMetrics {
    total_answered: number;
    total_correct: number;
    accuracy: number;
    total_time_seconds: number;
}

export interface PerformanceEvolution {
    date: string;
    accuracy: number;
    total: number;
}

export interface SpecialtyDiagnosis {
    metrics: SpecialtyMetrics;
    topics: TopicPerformance[];
    evolution: PerformanceEvolution[];
}
