import React from 'react';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '../../Shared/DateTimePicker';

interface TaskDeferUntilSectionProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const TaskDeferUntilSection: React.FC<TaskDeferUntilSectionProps> = ({
    value,
    onChange,
    placeholder,
}) => {
    const { t } = useTranslation();
    return (
        <div className="overflow-visible">
            <DateTimePicker
                value={value || ''}
                onChange={onChange}
                placeholder={placeholder ?? t('task.deferPlaceholder')}
            />
        </div>
    );
};

export default TaskDeferUntilSection;
