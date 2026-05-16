import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Member {
    user_id: string;
    first_name: string;
    last_name?: string | null;
    photo_url?: string | null;
}

interface MemberStackProps {
    members: Member[];
    maxDisplay?: number;
    size?: 'sm' | 'md' | 'lg';
}

export function MemberStack({ members, maxDisplay = 3, size = 'md' }: MemberStackProps) {
    const [streamToken, setStreamToken] = useState<string>('');
    const displayMembers = members.slice(0, maxDisplay);
    const extraCount = members.length - maxDisplay;

    useEffect(() => {
        invoke<string>('cmd_get_stream_token').then(setStreamToken).catch(console.error);
    }, []);

    const sizeClasses = {
        sm: 'w-6 h-6 text-[10px]',
        md: 'w-8 h-8 text-xs',
        lg: 'w-10 h-10 text-sm'
    };

    const overlapClasses = {
        sm: '-ml-2',
        md: '-ml-3',
        lg: '-ml-4'
    };

    const getInitials = (member: Member) => {
        return member.first_name[0] || '?';
    };

    const getBgColor = (id: string) => {
        // Telegram-like colors based on user_id
        const colors = [
            'bg-[#ff516a]', // Red
            'bg-[#ffa85c]', // Orange
            'bg-[#8e85ee]', // Violet
            'bg-[#70d05b]', // Green
            'bg-[#64d9f3]', // Cyan
            'bg-[#3ca5f0]', // Blue
            'bg-[#ff6c9a]', // Pink
        ];
        const strId = String(id);
        const numId = parseInt(strId.slice(-4)) || 0;
        return colors[numId % colors.length];
    };

    const getAvatarUrl = (userId: string) => {
        if (!streamToken) return null;
        return `http://127.0.0.1:1421/avatar/${userId}?token=${streamToken}`;
    };

    return (
        <div className="flex items-center">
            {displayMembers.map((member, index) => (
                <div
                    key={member.user_id}
                    className={`${sizeClasses[size]} rounded-full border-2 border-telegram-surface flex items-center justify-center text-white font-medium overflow-hidden relative ${index > 0 ? overlapClasses[size] : ''} z-[${maxDisplay - index}]`}
                    title={`${member.first_name} ${member.last_name || ''}`}
                >
                    <img 
                        src={getAvatarUrl(member.user_id) || ''} 
                        alt={member.first_name} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                        }}
                    />
                    <div className={`w-full h-full hidden items-center justify-center ${getBgColor(member.user_id)}`}>
                        {getInitials(member)}
                    </div>
                </div>
            ))}
            {extraCount > 0 && (
                <div
                    className={`${sizeClasses[size]} rounded-full border-2 border-telegram-surface bg-telegram-hover flex items-center justify-center text-telegram-subtext font-medium ${overlapClasses[size]} z-0`}
                >
                    +{extraCount}
                </div>
            )}
        </div>
    );
}
