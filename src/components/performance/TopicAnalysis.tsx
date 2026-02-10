import { motion } from 'framer-motion';
import { TopicPerformance } from '@/types/performance';
import { getPerformanceColor } from '@/components/dashboard/DashboardColors';
import { AlertCircle, CheckCircle, HelpCircle, MinusCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface TopicAnalysisProps {
    topics: TopicPerformance[];
    loading?: boolean;
}

export function TopicAnalysis({ topics, loading }: TopicAnalysisProps) {
    if (loading) return <div className="h-64 rounded-2xl bg-muted/20 animate-pulse" />;

    const ignoredTopics = topics.filter(t => t.status === 'Ignored');
    const weakTopics = topics.filter(t => t.status === 'Weak');
    const strongTopics = topics.filter(t => t.status === 'Strong');
    const averageTopics = topics.filter(t => t.status === 'Average');

    // Combine for display list (Priority: Ignored -> Weak -> Average -> Strong)
    const displayList = [...ignoredTopics, ...weakTopics, ...averageTopics, ...strongTopics];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h3 className="text-lg font-bold">Diagnóstico por Tema</h3>
                <div className="flex gap-2">
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                        <AlertCircle className="h-3 w-3" /> {ignoredTopics.length} Ignorados
                    </Badge>
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 gap-1">
                        <HelpCircle className="h-3 w-3" /> {weakTopics.length} Pontos de Atenção
                    </Badge>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
                        <CheckCircle className="h-3 w-3" /> {strongTopics.length} Pontos Fortes
                    </Badge>
                </div>
            </div>

            <ScrollArea className="h-[500px] rounded-2xl border border-border/50 bg-card/20 p-4">
                <div className="space-y-3">
                    {displayList.map((topic, index) => (
                        <motion.div
                            key={topic.topic}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="group flex flex-col gap-3 rounded-xl border border-border/40 bg-background/40 p-4 transition-all hover:bg-background/60 hover:shadow-lg hover:shadow-primary/5"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm line-clamp-1" title={topic.topic}>
                                    {topic.topic}
                                </span>
                                <Badge
                                    variant="secondary"
                                    className={`
                                        ${topic.status === 'Ignored' ? 'bg-destructive/10 text-destructive' : ''}
                                        ${topic.status === 'Weak' ? 'bg-yellow-500/10 text-yellow-500' : ''}
                                        ${topic.status === 'Strong' ? 'bg-emerald-500/10 text-emerald-500' : ''}
                                        ${topic.status === 'Average' ? 'bg-blue-500/10 text-blue-500' : ''}
                                    `}
                                >
                                    {topic.status === 'Ignored' ? 'Nunca Estudado' : `${topic.accuracy}%`}
                                </Badge>
                            </div>

                            {topic.status !== 'Ignored' ? (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
                                        <span>{topic.correct} acertos</span>
                                        <span>{topic.answered} / {topic.total_available} disponíveis</span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{
                                                width: `${topic.accuracy}%`,
                                                backgroundColor: getPerformanceColor(topic.accuracy)
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                                    <MinusCircle className="h-3 w-3" />
                                    <span>Este tema ainda não foi praticado.</span>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
