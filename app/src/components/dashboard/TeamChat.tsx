import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { MessageSquare, Send, Image as ImageIcon, FileText, Film, Music, Paperclip, Download, File } from 'lucide-react';
import { toast } from 'sonner';

interface ChatMessage {
    id: number;
    sender_id: number;
    sender_name: string;
    text: string;
    date: string;
    has_media: boolean;
    media_type: string;
    media_name: string;
    media_size: number;
    mime_type: string;
}

interface TeamChatProps {
    groupId: number;
    groupName: string;
}

export function TeamChat({ groupId, groupName }: TeamChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadMessages();
    }, [groupId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadMessages = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('Loading messages for group:', groupId);
            const result = await invoke<ChatMessage[]>('cmd_get_team_messages', { teamId: groupId, limit: 100 });
            console.log('Messages loaded:', result.length, result);
            setMessages(result);
        } catch (e) {
            console.error('Failed to load messages:', e);
            setError(String(e));
            toast.error(`Failed to load messages: ${e}`);
        } finally {
            setLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;
        try {
            setSending(true);
            await invoke('cmd_send_team_message', { teamId: groupId, message: newMessage });
            setNewMessage('');
            loadMessages();
            toast.success('Message sent!');
        } catch (e) {
            console.error('Failed to send message:', e);
            toast.error(`Failed to send: ${e}`);
        } finally {
            setSending(false);
        }
    };

    const handleDownload = async (msg: ChatMessage) => {
        if (!msg.has_media || downloadingId === msg.id) return;
        try {
            setDownloadingId(msg.id);
            
            const fileName = msg.media_name || `media_${msg.id}`;
            const ext = fileName.split('.').pop() || '';
            const defaultName = ext ? `${fileName}` : `${fileName}.${ext}`;
            
            const savePath = await save({
                defaultPath: defaultName,
                filters: [{ name: 'All Files', extensions: ['*'] }]
            });
            
            if (savePath) {
                await invoke('cmd_download_team_media', {
                    messageId: msg.id,
                    teamId: groupId,
                    savePath: savePath
                });
                toast.success('Downloaded successfully!');
            }
        } catch (e) {
            console.error('Download failed:', e);
            toast.error(`Download failed: ${e}`);
        } finally {
            setDownloadingId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const parts = dateStr.split(' ');
            if (parts.length >= 2) {
                return `${parts[0]} ${parts[1]}`;
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    const getMediaIcon = (type: string) => {
        switch (type) {
            case 'photo':
            case 'image':
                return <ImageIcon className="w-5 h-5" />;
            case 'video':
                return <Film className="w-5 h-5" />;
            case 'audio':
                return <Music className="w-5 h-5" />;
            case 'document':
                return <FileText className="w-5 h-5" />;
            default:
                return <Paperclip className="w-5 h-5" />;
        }
    };

    const getMediaColor = (type: string) => {
        switch (type) {
            case 'photo':
            case 'image':
                return 'text-green-500 bg-green-500/10';
            case 'video':
                return 'text-purple-500 bg-purple-500/10';
            case 'audio':
                return 'text-orange-500 bg-orange-500/10';
            case 'document':
                return 'text-blue-500 bg-blue-500/10';
            default:
                return 'text-gray-500 bg-gray-500/10';
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-telegram-bg overflow-hidden">
            <div className="px-6 py-4 border-b border-telegram-border bg-telegram-surface flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-telegram-primary/20 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-telegram-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-telegram-text">{groupName}</h2>
                        <p className="text-xs text-telegram-subtext">Last 2 days • {messages.length} messages</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-telegram-subtext">Loading messages...</div>
                    </div>
                ) : error && messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-telegram-subtext">
                        <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-red-500">Error loading messages</p>
                        <p className="text-xs mt-2 max-w-md text-center">{error}</p>
                        <button 
                            onClick={loadMessages}
                            className="mt-4 px-4 py-2 bg-telegram-primary text-white rounded-lg"
                        >
                            Retry
                        </button>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-telegram-subtext">
                        <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                        <p>No messages in the last 2 days</p>
                        <p className="text-sm">Be the first to send a message!</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className="flex gap-3 p-4 bg-telegram-surface rounded-xl border border-telegram-border hover:border-telegram-primary/30 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-full bg-telegram-primary/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-medium text-telegram-primary">
                                    {msg.sender_name[0]?.toUpperCase() || '?'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-sm font-medium text-telegram-text">{msg.sender_name}</span>
                                    <span className="text-xs text-telegram-subtext">{formatDate(msg.date)}</span>
                                </div>
                                
                                {msg.has_media && msg.media_type !== 'none' && (
                                    <div className={`flex items-center gap-3 p-3 rounded-lg mb-2 ${getMediaColor(msg.media_type)}`}>
                                        <div className="flex-shrink-0">
                                            {getMediaIcon(msg.media_type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-telegram-text truncate">{msg.media_name}</p>
                                            {msg.media_size > 0 && (
                                                <p className="text-xs opacity-70">{formatFileSize(msg.media_size)}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDownload(msg)}
                                            disabled={downloadingId === msg.id}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                                            title="Download"
                                        >
                                            {downloadingId === msg.id ? (
                                                <File className="w-4 h-4 animate-pulse" />
                                            ) : (
                                                <Download className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                )}
                                
                                <p className="text-sm text-telegram-text whitespace-pre-wrap break-words">
                                    {msg.text}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-telegram-border bg-telegram-surface flex-shrink-0">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-3 bg-telegram-hover rounded-xl text-telegram-text border border-telegram-border focus:border-telegram-primary outline-none transition-colors"
                        disabled={sending}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="px-5 py-3 bg-telegram-primary text-white rounded-xl hover:bg-telegram-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Send className="w-4 h-4" />
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}