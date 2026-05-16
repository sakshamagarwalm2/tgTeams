import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, User, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface TeamMember {
    user_id: string;
    first_name: string;
    last_name?: string | null;
    username?: string | null;
    phone?: string | null;
    photo_url?: string | null;
    access_hash?: string; // Added to help with invitations
}

interface AddSubscriberModalProps {
    teamId: number;
    onClose: () => void;
    onSuccess?: () => void;
}

export function AddSubscriberModal({ teamId, onClose, onSuccess }: AddSubscriberModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<TeamMember[]>([]);
    const [contacts, setContacts] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAdding, setIsAdding] = useState<string | null>(null);
    const [streamToken, setStreamToken] = useState<string>('');

    useEffect(() => {
        loadContacts();
        invoke<string>('cmd_get_stream_token').then(setStreamToken).catch(console.error);
    }, []);

    const getAvatarUrl = (userId: string) => {
        if (!streamToken) return null;
        return `http://127.0.0.1:1421/avatar/${userId}?token=${streamToken}`;
    };

    const getInitials = (member: TeamMember) => {
        return member.first_name[0] || '?';
    };

    const getBgColor = (id: string) => {
        const colors = [
            'bg-red-500', 'bg-green-500', 'bg-blue-500', 
            'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 
            'bg-indigo-500', 'bg-teal-500'
        ];
        const numId = parseInt(id.slice(-4)) || 0;
        return colors[numId % colors.length];
    };

    const loadContacts = async () => {
        try {
            const res = await invoke<TeamMember[]>('cmd_get_contacts');
            setContacts(res);
        } catch (e) {
            console.error('Failed to load contacts:', e);
        }
    };

    const handleSearch = async (term: string) => {
        setSearchTerm(term);
        if (term.length < 3) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const res = await invoke<TeamMember[]>('cmd_search_users', { query: term });
            setResults(res);
        } catch (e) {
            console.error('Search failed:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async (member: TeamMember) => {
        setIsAdding(member.user_id);
        try {
            await invoke('cmd_add_team_member', { 
                teamId, 
                userIdStr: member.user_id,
                accessHashStr: member.access_hash
            });
            toast.success(`Successfully invited ${member.first_name}`);
            if (onSuccess) onSuccess();
        } catch (e) {
            toast.error(`Failed to add: ${e}`);
        } finally {
            setIsAdding(null);
        }
    };

    const displayList = searchTerm.length >= 3 ? results : contacts;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-telegram-surface border border-telegram-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-telegram-border flex items-center justify-between">
                    <h3 className="font-semibold text-telegram-text">Add Subscriber</h3>
                    <button onClick={onClose} className="p-1 hover:bg-telegram-hover rounded-full transition-colors">
                        <X className="w-5 h-5 text-telegram-subtext" />
                    </button>
                </div>

                <div className="p-4">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-telegram-subtext" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search people or usernames..."
                            className="w-full bg-telegram-hover border border-telegram-border rounded-xl pl-10 pr-4 py-2 text-sm text-telegram-text focus:outline-none focus:border-telegram-primary/50 transition-colors"
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                        {isLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 className="w-4 h-4 text-telegram-primary animate-spin" />
                            </div>
                        )}
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {displayList.length > 0 ? (
                            displayList.map(member => (
                                <div key={member.user_id} className="flex items-center gap-3 p-2 hover:bg-telegram-hover rounded-xl transition-colors group">
                                    <div className="w-10 h-10 rounded-full border border-telegram-border flex items-center justify-center overflow-hidden">
                                        <img 
                                            src={getAvatarUrl(member.user_id) || ''} 
                                            alt="" 
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                                                if (fallback) fallback.style.display = 'flex';
                                            }}
                                        />
                                        <div className={`w-full h-full hidden items-center justify-center text-white text-xs font-bold ${getBgColor(member.user_id)}`}>
                                            {getInitials(member)}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-telegram-text truncate">
                                            {member.first_name} {member.last_name || ''}
                                        </p>
                                        <p className="text-xs text-telegram-subtext truncate">
                                            {member.username ? `@${member.username}` : member.phone || 'No username'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleAdd(member)}
                                        disabled={isAdding !== null}
                                        className="p-2 bg-telegram-primary/10 hover:bg-telegram-primary text-telegram-primary hover:text-white rounded-lg transition-all disabled:opacity-50"
                                    >
                                        {isAdding === member.user_id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <UserPlus className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center">
                                <p className="text-sm text-telegram-subtext">
                                    {searchTerm.length >= 3 ? 'No results found' : 'Showing your contacts'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-telegram-hover/50 text-center">
                    <p className="text-[10px] text-telegram-subtext uppercase tracking-wider font-bold">
                        Tip: You can search by name or @username
                    </p>
                </div>
            </div>
        </div>
    );
}
