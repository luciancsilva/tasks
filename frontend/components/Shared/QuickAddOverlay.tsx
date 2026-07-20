import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { createInboxItem } from '../../utils/inboxService';

interface QuickAddOverlayProps {
    onClose: () => void;
}

const QuickAddOverlay: React.FC<QuickAddOverlayProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async () => {
        if (!value.trim()) {
            onClose();
            return;
        }
        setSaving(true);
        try {
            await createInboxItem(value.trim(), 'quick-add');
            setValue('');
        } catch (error) {
            console.error('Failed to create quick-add inbox item:', error);
        } finally {
            setSaving(false);
            onClose();
        }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    });

    return createPortal(
        <div 
            className="fixed inset-0 z-[110] flex items-start justify-center pt-32 bg-black/30" 
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg p-4" 
                onClick={(e) => e.stopPropagation()}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={t('quickAdd.placeholder', 'Capture anything... #tag +project @person $area !priority')}
                    className="w-full text-lg px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                    disabled={saving}
                />
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{t('quickAdd.hint', 'Enter = capture to Inbox · Esc = close')}</span>
                    {saving && <span>{t('quickAdd.saving', 'Saving...')}</span>}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default QuickAddOverlay;
