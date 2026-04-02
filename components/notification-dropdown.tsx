'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { 
  subscribeToNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  Notification 
} from '@/lib/notifications';
import { 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  X, 
  Trash2, 
  Check,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationDropdown() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;

    const unsubscribe = subscribeToNotifications(profile.uid, (data) => {
      setNotifications(data);
    });

    return () => unsubscribe();
  }, [profile]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'error': return <AlertCircle className="text-red-500" size={16} />;
      case 'warning': return <AlertCircle className="text-orange-500" size={16} />;
      default: return <Info className="text-blue-500" size={16} />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl shadow-gray-500/10 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 dark:text-white">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button 
                      onClick={() => markAllAsRead(profile?.uid!)}
                      className="text-[10px] font-bold text-orange-600 dark:text-orange-500 hover:underline flex items-center gap-1"
                    >
                      <Check size={12} /> Mark all as read
                    </button>
                  )}
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <Bell size={32} className="text-gray-200 dark:text-gray-700 mx-auto" />
                    <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                    {notifications.map((n) => (
                      <div 
                        key={n.id}
                        onClick={() => !n.isRead && markAsRead(n.id)}
                        className={`p-4 flex gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer relative group ${!n.isRead ? 'bg-orange-50/30 dark:bg-orange-500/5' : ''}`}
                      >
                        <div className="shrink-0 mt-1">
                          {getIcon(n.type)}
                        </div>
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`text-sm font-bold truncate ${!n.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap flex items-center gap-1">
                              <Clock size={10} />
                              {n.createdAt ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                            {n.message}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="absolute right-2 bottom-2 p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 text-center">
                  <button className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors">
                    View All Activity
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
