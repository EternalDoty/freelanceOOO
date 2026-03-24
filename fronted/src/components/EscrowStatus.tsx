import React from 'react';
import { CheckCircle, Clock, AlertCircle, Lock, Unlock, XCircle } from 'lucide-react';

interface EscrowStatusProps {
  status: string;
  amount: number;
  commission: number;
  netAmount: number;
  currency: string;
  onRelease?: () => void;
  onDispute?: () => void;
  canRelease?: boolean;
  canDispute?: boolean;
}

export const EscrowStatus: React.FC<EscrowStatusProps> = ({
  status,
  amount,
  commission,
  netAmount,
  currency,
  onRelease,
  onDispute,
  canRelease,
  canDispute,
}) => {
  const getStatusInfo = () => {
    const statusMap: Record<string, { 
      label: string; 
      color: string; 
      icon: React.ReactNode;
      description: string;
    }> = {
      INIT: {
        label: 'Инициализирован',
        color: 'bg-gray-100 text-gray-600',
        icon: <Lock className="w-6 h-6" />,
        description: 'Сделка создана, ожидает оплаты'
      },
      FUNDED: {
        label: 'Оплачен',
        color: 'bg-green-100 text-green-600',
        icon: <CheckCircle className="w-6 h-6" />,
        description: 'Средства зарезервированы'
      },
      IN_PROGRESS: {
        label: 'В работе',
        color: 'bg-blue-100 text-blue-600',
        icon: <Clock className="w-6 h-6" />,
        description: 'Исполнитель работает над задачей'
      },
      PENDING_RELEASE: {
        label: 'Ожидает подтверждения',
        color: 'bg-yellow-100 text-yellow-600',
        icon: <Clock className="w-6 h-6" />,
        description: 'Работа завершена, ожидает подтверждения заказчиком'
      },
      RELEASED: {
        label: 'Выплачен',
        color: 'bg-green-100 text-green-600',
        icon: <Unlock className="w-6 h-6" />,
        description: 'Средства переведены исполнителю'
      },
      REFUNDED: {
        label: 'Возвращен',
        color: 'bg-red-100 text-red-600',
        icon: <XCircle className="w-6 h-6" />,
        description: 'Средства возвращены заказчику'
      },
      DISPUTE: {
        label: 'Спор',
        color: 'bg-orange-100 text-orange-600',
        icon: <AlertCircle className="w-6 h-6" />,
        description: 'Требуется вмешательство модератора'
      },
    };

    return statusMap[status] || statusMap.INIT;
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Статус Escrow</h3>
      
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusInfo.color} mb-4`}>
        {statusInfo.icon}
        <span className="font-medium">{statusInfo.label}</span>
      </div>

      <p className="text-gray-600 mb-6">{statusInfo.description}</p>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-gray-600">Сумма сделки:</span>
          <span className="font-medium text-gray-900">
            {amount.toLocaleString('ru-RU')} {currency}
          </span>
        </div>
        
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-gray-600">Комиссия платформы:</span>
          <span className="font-medium text-gray-900">
            {commission.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} {currency}
          </span>
        </div>
        
        <div className="flex justify-between items-center py-2">
          <span className="text-gray-600">Исполнитель получит:</span>
          <span className="font-medium text-green-600">
            {netAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} {currency}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        {canRelease && onRelease && (
          <button
            onClick={onRelease}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Подтвердить и выплатить
          </button>
        )}
        
        {canDispute && onDispute && status !== 'DISPUTE' && (
          <button
            onClick={onDispute}
            className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Открыть спор
          </button>
        )}
      </div>
    </div>
  );
};