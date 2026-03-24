import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { appealsApi } from '../services/api';

interface AppealFormProps {
  userId: string;
  appealType: 'block' | 'review' | 'dispute';
  targetId?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const AppealForm: React.FC<AppealFormProps> = ({
  userId,
  appealType,
  targetId,
  onSuccess,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      toast.error('Пожалуйста, укажите причину апелляции');
      return;
    }

    setIsSubmitting(true);

    try {
      await appealsApi.create({
        appeal_type: appealType,
        target_id: targetId,
        reason,
        evidence,
      });

      toast.success('Апелляция создана успешно');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при создании апелляции');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // In real implementation, upload files to server and get URLs
      const fileUrls = Array.from(files).map(file => URL.createObjectURL(file));
      setEvidence([...evidence, ...fileUrls]);
    }
  };

  const removeEvidence = (index: number) => {
    setEvidence(evidence.filter((_, i) => i !== index));
  };

  const getAppealTypeLabel = () => {
    switch (appealType) {
      case 'block': return 'Апелляция на блокировку';
      case 'review': return 'Апелляция на отзыв';
      case 'dispute': return 'Апелляция на спор';
      default: return 'Апелляция';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{getAppealTypeLabel()}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Причина апелляции *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Опишите подробно вашу ситуацию..."
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Доказательства
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-2">
                Прикрепите скриншоты, документы или другие доказательства
              </p>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="evidence-upload"
              />
              <label
                htmlFor="evidence-upload"
                className="inline-block px-4 py-2 bg-primary-50 text-primary-700 rounded-lg cursor-pointer hover:bg-primary-100 transition-colors"
              >
                Выбрать файлы
              </label>
            </div>

            {evidence.length > 0 && (
              <div className="mt-4 space-y-2">
                {evidence.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                    <span className="text-sm text-gray-600 truncate">{file}</span>
                    <button
                      type="button"
                      onClick={() => removeEvidence(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              ⏱️ Апелляции рассматриваются модераторами в течение 48 часов. 
              Статус можно отслеивать в личном кабинете.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Отправка...' : 'Отправить апелляцию'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};