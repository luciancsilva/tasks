import React from 'react';
import { useTranslation } from 'react-i18next';
import DatePicker from '../../Shared/DatePicker';

interface TaskDueDateSectionProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const TaskDueDateSection: React.FC<TaskDueDateSectionProps> = ({
    value,
    onChange,
    placeholder,
}) => {
    const { t } = useTranslation();
    return (
        <div className="overflow-visible">
            <DatePicker
                value={value || ''}
                onChange={onChange}
                placeholder={placeholder ?? t('task.duePlaceholder')}
            />
        </div>
    );
};

export default TaskDueDateSection;
