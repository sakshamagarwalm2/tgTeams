import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import {
    AtSign,
    Download,
    File,
    FileText,
    Film,
    Image as ImageIcon,
    Mic,
    MoreVertical,
    Music,
    Paperclip,
    Pin,
    Search,
    Send,
    Smile,
    UserPlus,
    Users,
    Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { TelegramAvatar } from './TelegramAvatar';

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
    outgoing?: boolean;
    pinned?: boolean;
}

interface TeamChatProps {
    groupId: number | null;
    groupName: string;
    memberCount?: number;
    canManageMembers?: boolean;
    isDirect?: boolean;
    onManageMembers?: () => void;
}

export function TeamChat({
    groupId,
    groupName,
    memberCount,
    canManageMembers = false,
    isDirect = false,
    onManageMembers,
}: TeamChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [streamToken, setStreamToken] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadMessages();
        const timer = window.setInterval(() => loadMessages(true), 5000);
        return () => window.clearInterval(timer);
    }, [groupId]);

    useEffect(() => {
        invoke<string>('cmd_get_stream_token').then(setStreamToken).catch(console.error);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadMessages = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            setError(null);
            const result = await invoke<ChatMessage[]>('cmd_get_team_messages', { teamId: groupId, limit: 1000 });
            setMessages(result.slice().reverse());
        } catch (e) {
            setError(String(e));
            if (!silent) toast.error(`Failed to load messages: ${e}`);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;
        try {
            setSending(true);
            await invoke('cmd_send_team_message', { teamId: groupId, message: newMessage });
            setNewMessage('');
            loadMessages(true);
        } catch (e) {
            toast.error(`Failed to send: ${e}`);
        } finally {
            setSending(false);
        }
    };

    const handleAttach = async () => {
        if (uploading) return;
        try {
            const selected = await open({
                multiple: false,
                directory: false,
            });
            if (!selected || Array.isArray(selected)) return;

            setUploading(true);
            await invoke('cmd_upload_file', {
                path: selected,
                folderId: groupId,
                transferId: `team-${groupId ?? 'self'}-${Date.now()}`,
            });
            toast.success('File sent');
            loadMessages(true);
        } catch (e) {
            toast.error(`Failed to attach file: ${e}`);
        } finally {
            setUploading(false);
        }
    };

    const handleMention = () => {
        setNewMessage((value) => `${value}${value && !value.endsWith(' ') ? ' ' : ''}@`);
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const handlePin = async (messageId: number) => {
        try {
            await invoke('cmd_pin_team_message', { teamId: groupId, messageId });
            toast.success('Message pinned');
            loadMessages(true);
        } catch (e) {
            toast.error(`Failed to pin message: ${e}`);
        }
    };

    const handleVoice = () => {
        toast.info('Voice recording needs a recorder-to-file bridge. You can attach audio files now.');
    };

    const handleDownload = async (msg: ChatMessage) => {
        if (!msg.has_media || downloadingId === msg.id) return;
        try {
            setDownloadingId(msg.id);
            const fileName = msg.media_name || `media_${msg.id}`;
            const savePath = await save({
                defaultPath: fileName,
                filters: [{ name: 'All Files', extensions: ['*'] }],
            });

            if (savePath) {
                await invoke('cmd_download_team_media', {
                    messageId: msg.id,
                    teamId: groupId,
                    savePath,
                });
                toast.success('Downloaded successfully');
            }
        } catch (e) {
            toast.error(`Download failed: ${e}`);
        } finally {
            setDownloadingId(null);
        }
    };

    const formatTime = (dateStr: string) => {
        const parsed = new Date(dateStr.replace(' ', 'T'));
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return dateStr.split(' ')[1]?.slice(0, 5) || dateStr;
    };

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '';
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

    return (
        <div className="flex-1 flex flex-col bg-telegram-bg overflow-hidden">
            <div className="h-16 px-4 border-b border-telegram-border bg-telegram-surface flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-telegram-primary/15 text-telegram-primary flex items-center justify-center overflow-hidden">
                        {isDirect ? (
                            <TelegramAvatar user={{ user_id: groupId ?? 'self', first_name: groupName }} token={streamToken} size="lg" className="border-0" />
                        ) : (
                            <Users className="w-5 h-5" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-telegram-text truncate">{groupName}</h2>
                        <p className="text-xs text-telegram-subtext truncate">
                            {isDirect ? 'direct chat' : `${memberCount ?? 0} members`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button className="p-2 text-telegram-subtext hover:text-telegram-text hover:bg-telegram-hover rounded-full transition-colors" title="Search">
                        <Search className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-telegram-subtext hover:text-telegram-text hover:bg-telegram-hover rounded-full transition-colors" title="Start meeting">
                        <Video className="w-5 h-5" />
                    </button>
                    {canManageMembers && !isDirect && (
                        <button
                            onClick={onManageMembers}
                            className="p-2 text-telegram-subtext hover:text-telegram-text hover:bg-telegram-hover rounded-full transition-colors"
                            title="Manage members"
                        >
                            <UserPlus className="w-5 h-5" />
                        </button>
                    )}
                    <button className="p-2 text-telegram-subtext hover:text-telegram-text hover:bg-telegram-hover rounded-full transition-colors" title="More">
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 custom-scrollbar">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-sm text-telegram-subtext">Loading messages...</div>
                ) : error && messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-sm text-telegram-subtext">
                        <p className="text-red-400">Error loading messages</p>
                        <p className="mt-2 max-w-md text-center text-xs">{error}</p>
                        <button onClick={() => loadMessages()} className="mt-4 px-4 py-2 bg-telegram-primary text-white rounded-lg">
                            Retry
                        </button>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-telegram-subtext">
                        No messages yet
                    </div>
                ) : (
                    <div className="space-y-2">
                        {messages.map((msg) => {
                            const outgoing = Boolean(msg.outgoing);
                            return (
                                <div key={msg.id} className={`group flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex gap-2 max-w-[78%] ${outgoing ? 'flex-row-reverse' : ''}`}>
                                        {!outgoing && !isDirect && (
                                            <TelegramAvatar
                                                user={{ user_id: msg.sender_id, first_name: msg.sender_name }}
                                                token={streamToken}
                                                size="md"
                                                className="mt-1"
                                            />
                                        )}
                                        <div
                                            className={`rounded-2xl px-3 py-2 shadow-sm ${
                                                outgoing
                                                    ? 'rounded-br-md bg-telegram-primary text-white'
                                                    : 'rounded-bl-md bg-telegram-surface text-telegram-text border border-telegram-border'
                                            }`}
                                        >
                                            {!outgoing && !isDirect && (
                                                <p className="mb-1 text-xs font-semibold text-telegram-primary">{msg.sender_name}</p>
                                            )}
                                            {msg.has_media && msg.media_type !== 'none' && (
                                                <button
                                                    onClick={() => handleDownload(msg)}
                                                    disabled={downloadingId === msg.id}
                                                    className={`mb-2 flex w-full min-w-56 items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                                                        outgoing ? 'bg-white/15 hover:bg-white/20' : 'bg-telegram-hover hover:bg-white/10'
                                                    } disabled:opacity-60`}
                                                >
                                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                                                        {downloadingId === msg.id ? <File className="w-5 h-5 animate-pulse" /> : getMediaIcon(msg.media_type)}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-medium">{msg.media_name || msg.media_type}</span>
                                                        {msg.media_size > 0 && <span className="text-xs opacity-75">{formatFileSize(msg.media_size)}</span>}
                                                    </span>
                                                    <Download className="w-4 h-4 opacity-75" />
                                                </button>
                                            )}
                                            {msg.text && (
                                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.text}</p>
                                            )}
                                            <div className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${outgoing ? 'text-white/70' : 'text-telegram-subtext'}`}>
                                                {msg.pinned && <Pin className="h-3 w-3" />}
                                                <button
                                                    onClick={() => handlePin(msg.id)}
                                                    className="opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"
                                                    title="Pin message"
                                                >
                                                    <Pin className="h-3 w-3" />
                                                </button>
                                                <span>{formatTime(msg.date)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-telegram-border bg-telegram-surface p-3 flex-shrink-0">
                <div className="flex items-end gap-2 rounded-2xl bg-telegram-hover px-2 py-2 border border-telegram-border">
                    <button
                        onClick={handleAttach}
                        disabled={uploading}
                        className="p-2 text-telegram-subtext hover:text-telegram-text rounded-full transition-colors disabled:opacity-50"
                        title="Attach"
                    >
                        <Paperclip className={`w-5 h-5 ${uploading ? 'animate-pulse' : ''}`} />
                    </button>
                    <button onClick={handleMention} className="p-2 text-telegram-subtext hover:text-telegram-text rounded-full transition-colors" title="Mention">
                        <AtSign className="w-5 h-5" />
                    </button>
                    <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                        placeholder="Message"
                        className="min-h-10 flex-1 bg-transparent px-1 py-2 text-sm text-telegram-text placeholder:text-telegram-subtext outline-none"
                        disabled={sending}
                    />
                    <button className="p-2 text-telegram-subtext hover:text-telegram-text rounded-full transition-colors" title="Emoji">
                        <Smile className="w-5 h-5" />
                    </button>
                    <button onClick={handleVoice} className="p-2 text-telegram-subtext hover:text-telegram-text rounded-full transition-colors" title="Voice">
                        <Mic className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="p-2 bg-telegram-primary text-white rounded-full hover:bg-telegram-primary/90 transition-colors disabled:opacity-50"
                        title="Send"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
