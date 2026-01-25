/**
 * StatCard Component
 * Dashboard stat widget with icon, value, and trend
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from './Card';
import { cn, formatNumber } from '../lib/utils';

export interface StatCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  format?: 'number' | 'currency' | 'percentage' | 'custom';
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  icon,
  format = 'number',
  className,
}: StatCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  const formattedValue =
    typeof value === 'number'
      ? format === 'number'
        ? formatNumber(value)
        : format === 'currency'
        ? `$${formatNumber(value)}`
        : format === 'percentage'
        ? `${value.toFixed(1)}%`
        : value
      : value;

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {title}
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {formattedValue}
            </p>
            
            {change !== undefined && (
              <div className="flex items-center mt-2 text-sm">
                {isPositive && (
                  <>
                    <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-green-600 font-medium">
                      +{change.toFixed(1)}%
                    </span>
                  </>
                )}
                {isNegative && (
                  <>
                    <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                    <span className="text-red-600 font-medium">
                      {change.toFixed(1)}%
                    </span>
                  </>
                )}
                {!isPositive && !isNegative && (
                  <span className="text-gray-500 font-medium">0%</span>
                )}
                <span className="text-gray-500 ml-2">{changeLabel}</span>
              </div>
            )}
          </div>
          
          {icon && (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900">
              <div className="text-blue-600 dark:text-blue-300">{icon}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
