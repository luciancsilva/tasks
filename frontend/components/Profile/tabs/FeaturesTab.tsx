import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProfileFormData, Features } from '../types';

interface FeaturesTabProps {
    isActive: boolean;
    eisenhowerEnabled: boolean;
    onToggleEisenhower: () => void;
    kanbanEnabled: boolean;
    onToggleKanban: () => void;
    habitsEnabled: boolean;
    onToggleHabits: () => void;
    calendarEnabled: boolean;
    onToggleCalendar: () => void;
    formData: ProfileFormData;
    onToggleAi: (field: keyof Features) => void;
    onChangeField: (field: keyof ProfileFormData, value: any) => void;
}

interface ToggleRowProps {
    label: string;
    description: string;
    value: boolean;
    onToggle: () => void;
    last?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
    label,
    description,
    value,
    onToggle,
    last,
}) => (
    <div
        className={`flex items-center justify-between py-4 ${
            last ? '' : 'border-b border-gray-200 dark:border-gray-700'
        }`}
    >
        <div className="pr-8">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description}
            </p>
        </div>
        <div
            className={`relative inline-block w-12 h-6 flex-shrink-0 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={onToggle}
        >
            <span
                className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                    value ? 'translate-x-6' : 'translate-x-0'
                }`}
            />
        </div>
    </div>
);

const FeaturesTab: React.FC<FeaturesTabProps> = ({
    isActive,
    eisenhowerEnabled,
    onToggleEisenhower,
    kanbanEnabled,
    onToggleKanban,
    habitsEnabled,
    onToggleHabits,
    calendarEnabled,
    onToggleCalendar,
    formData,
    onToggleAi,
    onChangeField,
}) => {
    const { t } = useTranslation();
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    const handleTestAi = async () => {
        setTestStatus('testing');
        setTestMessage('');
        try {
            const api = (await import('../../../utils/api')).default;
            const payload = {
                ai_provider: formData.ai_provider || 'openai',
                ai_api_key: formData.ai_api_key || '',
                ai_model: formData.ai_model || '',
                ai_base_url: formData.ai_base_url || '',
            };
            const res = await api.post('/api/ai-assistant/test', payload);
            if (res.data.success) {
                setTestStatus('success');
                setTestMessage('Connection successful!');
            } else {
                setTestStatus('error');
                setTestMessage(res.data.error || 'Connection failed.');
            }
        } catch (error: any) {
            setTestStatus('error');
            setTestMessage(error?.response?.data?.error || error.message || 'Error connecting to AI API');
        }
    };

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {t('profile.featuresAddons', 'Features & Add-ons')}
            </h3>

            <div className="space-y-0">
                <ToggleRow
                    label={t('sidebar.habits', 'Habits')}
                    description={t(
                        'profile.habitsDescription',
                        'Enable the Habits section for tracking recurring behaviours and streaks.'
                    )}
                    value={habitsEnabled}
                    onToggle={onToggleHabits}
                />
                <ToggleRow
                    label={t('sidebar.eisenhower', 'Eisenhower Matrix')}
                    description={t(
                        'profile.eisenhowerDescription',
                        'Enable the Eisenhower Matrix page for prioritising tasks by urgency and importance.'
                    )}
                    value={eisenhowerEnabled}
                    onToggle={onToggleEisenhower}
                />
                <ToggleRow
                    label={t('sidebar.kanban', 'Kanban Board')}
                    description={t(
                        'profile.kanbanDescription',
                        'Enable the Kanban Board for tracking task progress across swimlanes.'
                    )}
                    value={kanbanEnabled}
                    onToggle={onToggleKanban}
                />
                <ToggleRow
                    label={t('sidebar.calendar', 'Calendar')}
                    description={t(
                        'profile.calendarDescription',
                        'Enable the Calendar view for visualising tasks by due date across day, week, and month.'
                    )}
                    value={calendarEnabled}
                    onToggle={onToggleCalendar}
                />
            </div>

            <div className="mt-8">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                    {t('profile.intelligenceSection', 'Intelligence')}
                </h4>
                <div className="space-y-0">
                    <ToggleRow
                        label={t(
                            'profile.taskIntelligenceLabel',
                            'Task Intelligence Assistant'
                        )}
                        description={t(
                            'profile.taskIntelligenceDescription',
                            'Show popup alerts while typing task names that suggest improvements like "Make it more descriptive!", "Be more specific!", or "Add an action verb!". Disable this if you prefer typing in your own shorthand without suggestions.'
                        )}
                        value={Boolean(formData.features?.task_intelligence_enabled)}
                        onToggle={() => onToggleAi('task_intelligence_enabled')}
                    />
                    <ToggleRow
                        label={t(
                            'profile.autoSuggestNextActionsLabel',
                            'Next Action Prompts'
                        )}
                        description={t(
                            'profile.autoSuggestNextActionsDescription',
                            'When creating a project, automatically prompt for the very next physical action to take.'
                        )}
                        value={Boolean(formData.features?.auto_suggest_next_actions_enabled)}
                        onToggle={() =>
                            onToggleAi('auto_suggest_next_actions_enabled')
                        }
                    />
                    <ToggleRow
                        label={t(
                            'profile.productivityAssistantLabel',
                            'Productivity Insights'
                        )}
                        description={t(
                            'profile.productivityAssistantDescription',
                            'Show productivity insights that help identify stalled projects, vague tasks, and workflow improvements on your Today page.'
                        )}
                        value={Boolean(formData.features?.productivity_assistant_enabled)}
                        onToggle={() =>
                            onToggleAi('productivity_assistant_enabled')
                        }
                    />
                    <ToggleRow
                        label={t(
                            'profile.nextTaskSuggestionLabel',
                            'Next Task Suggestions'
                        )}
                        description={t(
                            'profile.nextTaskSuggestionDescription',
                            'Automatically suggest the next best task to work on when you have nothing in progress, prioritizing due today tasks, then suggested tasks, then next actions.'
                        )}
                        value={Boolean(formData.features?.next_task_suggestion_enabled)}
                        onToggle={() =>
                            onToggleAi('next_task_suggestion_enabled')
                        }
                    />
                    <ToggleRow
                        label={t(
                            'profile.aiAssistantLabel',
                            'AI Assistant (Daily Brief & Insights)'
                        )}
                        description={t(
                            'profile.aiAssistantDescription',
                            'Enable AI-powered daily brief on the Today page and task/project insights. Requires OPENAI_API_KEY configured on the server.'
                        )}
                        value={Boolean(formData.features?.ai_assistant_enabled)}
                        onToggle={() => onToggleAi('ai_assistant_enabled')}
                        last={!formData.features?.ai_assistant_enabled}
                    />

                    {formData.features?.ai_assistant_enabled && (
                        <div className="pl-4 mt-2 mb-6 border-l-2 border-blue-500 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('profile.aiProviderLabel', 'AI Provider')}
                                </label>
                                <select
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.ai_provider || 'openai'}
                                    onChange={(e) => onChangeField('ai_provider', e.target.value)}
                                >
                                    <option value="openai">OpenAI</option>
                                    <option value="openrouter">OpenRouter</option>
                                    <option value="custom">Custom (OpenAI Compatible)</option>
                                </select>
                            </div>

                            {formData.ai_provider === 'custom' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {t('profile.aiBaseUrlLabel', 'Base URL')}
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://api.example.com/v1"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={formData.ai_base_url || ''}
                                        onChange={(e) => onChangeField('ai_base_url', e.target.value)}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('profile.aiModelLabel', 'Model Name')}
                                </label>
                                <input
                                    type="text"
                                    placeholder={formData.ai_provider === 'openrouter' ? 'meta-llama/llama-3-8b-instruct' : 'gpt-4o-mini'}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.ai_model || ''}
                                    onChange={(e) => onChangeField('ai_model', e.target.value)}
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave empty for default (gpt-4o-mini).</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('profile.aiApiKeyLabel', 'API Key')}
                                </label>
                                <input
                                    type="password"
                                    placeholder={formData.has_ai_api_key ? '******** (configured)' : 'sk-...'}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={formData.ai_api_key || ''}
                                    onChange={(e) => onChangeField('ai_api_key', e.target.value)}
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave empty to keep existing key.</p>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleTestAi}
                                    disabled={testStatus === 'testing'}
                                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                    {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                                </button>
                                {testStatus === 'success' && <span className="ml-3 text-sm text-green-600">{testMessage}</span>}
                                {testStatus === 'error' && <span className="ml-3 text-sm text-red-600">{testMessage}</span>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FeaturesTab;
