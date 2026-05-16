import { useState, useEffect } from 'react';
import { HardDrive, Folder, Plus, RefreshCw, LogOut, Users, LayoutGrid, ChevronDown, ChevronRight, Settings, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { SidebarItem } from './SidebarItem';
import { BandwidthWidget } from './BandwidthWidget';
import { TeamsPanel } from './TeamsPanel';
import { MemberStack } from './MemberStack';
import { TelegramFolder, BandwidthStats } from '../../types';

interface GroupInfo {
    id: number;
    name: string;
    username: string | null;
    member_count: number;
    top_members?: any[];
}

interface SidebarProps {
    folders: TelegramFolder[];
    activeFolderId: number | null;
    setActiveFolderId: (id: number | null) => void;
    activeGroupId: number | null;
    setActiveGroupId: (id: number | null) => void;
    onDrop: (e: React.DragEvent, folderId: number | null) => void;
    onDelete: (id: number, name: string) => void;
    onRename: (id: number, currentName: string, newName: string) => void;
    onCreate: (name: string) => Promise<void>;
    isSyncing: boolean;
    isConnected: boolean;
    onSync: () => void;
    onLogout: () => void;
    bandwidth: BandwidthStats | null;
}

export function Sidebar({
    folders, activeFolderId, setActiveFolderId, activeGroupId, setActiveGroupId, onDrop, onDelete, onRename, onCreate,
    isSyncing, isConnected, onSync, onLogout, bandwidth
}: SidebarProps) {
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [driveExpanded, setDriveExpanded] = useState(true);
    const [teamsExpanded, setTeamsExpanded] = useState(true);
    const [showTeamsPanel, setShowTeamsPanel] = useState(false);
    const [groups, setGroups] = useState<GroupInfo[]>([]);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const result = await invoke<GroupInfo[]>('cmd_get_teams');
            setGroups(result);
        } catch (e) {
            console.error('Failed to load groups:', e);
        }
    };

    const submitCreate = async () => {
        if (!newFolderName.trim()) return;
        try {
            await onCreate(newFolderName);
            setNewFolderName("");
            setShowNewFolderInput(false);
        } catch {
            // handled by parent
        }
    }

    const handleCreateGroup = async () => {
        const name = prompt('Enter group name:');
        if (!name) return;
        try {
            await invoke('cmd_create_team', { name, description: null });
            loadGroups();
        } catch (e) {
            console.error('Failed to create group:', e);
        }
    };

    return (
        <aside className="w-64 bg-telegram-surface border-r border-telegram-border flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 flex items-center gap-2">
                <img src="/logo.svg" className="w-8 h-8 drop-shadow-lg" alt="Logo" />
                <span className="font-bold text-lg text-telegram-text tracking-tight">tgTeams</span>
            </div>

            <nav className="flex-1 px-2 py-4 space-y-6 overflow-y-auto min-h-0">
                <div>
                    <button
                        onClick={() => setDriveExpanded(!driveExpanded)}
                        className="w-full px-3 mb-2 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-2 text-[10px] font-bold text-telegram-subtext uppercase tracking-[0.1em] group-hover:text-telegram-text transition-colors">
                            <HardDrive className="w-3 h-3" />
                            Drive
                        </div>
                        {driveExpanded ? <ChevronDown className="w-3 h-3 text-telegram-subtext" /> : <ChevronRight className="w-3 h-3 text-telegram-subtext" />}
                    </button>

                    <AnimatePresence initial={false}>
                        {driveExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden space-y-1"
                            >
                                <SidebarItem
                                    icon={LayoutGrid}
                                    label="Saved Messages"
                                    active={activeFolderId === null && activeGroupId === null}
                                    onClick={() => {
                                        setActiveFolderId(null);
                                        setActiveGroupId(null);
                                    }}
                                    onDrop={(e: React.DragEvent) => onDrop(e, null)}
                                    folderId={null}
                                />
                                {folders.map(folder => (
                                    <SidebarItem
                                        key={folder.id}
                                        icon={Folder}
                                        label={folder.name}
                                        active={activeFolderId === folder.id}
                                        onClick={() => {
                                            setActiveFolderId(folder.id);
                                            setActiveGroupId(null);
                                        }}
                                        onDrop={(e: React.DragEvent) => onDrop(e, folder.id)}
                                        onDelete={() => onDelete(folder.id, folder.name)}
                                        onRename={(newName) => onRename(folder.id, folder.name, newName)}
                                        folderId={folder.id}
                                        memberCount={folder.member_count}
                                        topMembers={folder.top_members}
                                        />
                                ))}

                                <div className="pt-2">
                                    {showNewFolderInput ? (
                                        <div className="px-3 py-2">
                                            <input
                                                autoFocus
                                                type="text"
                                                className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-white border border-telegram-border focus:outline-none focus:ring-1 focus:ring-telegram-primary"
                                                placeholder="Folder Name"
                                                value={newFolderName}
                                                onChange={e => setNewFolderName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && submitCreate()}
                                                onBlur={() => !newFolderName && setShowNewFolderInput(false)}
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowNewFolderInput(true)}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-telegram-subtext hover:bg-telegram-hover hover:text-telegram-text transition-all border border-dashed border-telegram-border/50 hover:border-telegram-border"
                                        >
                                            <Plus className="w-3 h-3" />
                                            New Folder
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div>
                    <button
                        onClick={() => setTeamsExpanded(!teamsExpanded)}
                        className="w-full px-3 mb-2 flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-2 text-[10px] font-bold text-telegram-subtext uppercase tracking-[0.1em] group-hover:text-telegram-text transition-colors">
                            <Users className="w-3 h-3" />
                            Groups
                        </div>
                        {teamsExpanded ? <ChevronDown className="w-3 h-3 text-telegram-subtext" /> : <ChevronRight className="w-3 h-3 text-telegram-subtext" />}
                    </button>

                    <AnimatePresence initial={false}>
                        {teamsExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden space-y-1"
                            >
                                {groups.map(group => (
                                    <button
                                        key={group.id}
                                        onClick={() => {
                                            setActiveGroupId(group.id);
                                            setActiveFolderId(null);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                            activeGroupId === group.id
                                                ? 'bg-telegram-primary/10 text-telegram-primary border border-telegram-primary/20'
                                                : 'text-telegram-text hover:bg-telegram-hover'
                                        }`}
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="truncate">{group.name}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {group.top_members && group.top_members.length > 0 && (
                                                <MemberStack members={group.top_members} size="sm" maxDisplay={2} />
                                            )}
                                        </div>
                                    </button>
                                ))}

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleCreateGroup}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-telegram-subtext hover:bg-telegram-hover hover:text-telegram-text transition-all border border-dashed border-telegram-border/50"
                                    >
                                        <Plus className="w-3 h-3" />
                                        New
                                    </button>
                                    <button
                                        onClick={() => setShowTeamsPanel(true)}
                                        className="p-2 rounded-lg text-telegram-subtext hover:bg-telegram-hover hover:text-telegram-text transition-all"
                                        title="Group Manager"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </nav>

            <div className="p-4 border-t border-telegram-border">
                <div className="flex items-center gap-2 text-telegram-subtext text-[10px] font-medium">
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                    <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>

                <div className="flex gap-2 mt-4">
                    <button
                        onClick={onSync}
                        disabled={isSyncing}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-all ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        Sync
                    </button>
                    <button
                        onClick={onLogout}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all"
                    >
                        <LogOut className="w-3 h-3" />
                        Exit
                    </button>
                </div>

                {bandwidth && <BandwidthWidget bandwidth={bandwidth} />}
            </div>

            {showTeamsPanel && (
                <div className="fixed inset-0 bg-black/50 z-50 flex">
                    <div className="ml-64 w-[800px] bg-telegram-surface rounded-r-xl border border-telegram-border overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-telegram-border">
                            <h2 className="text-lg font-semibold text-telegram-text">Group Manager</h2>
                            <button
                                onClick={() => setShowTeamsPanel(false)}
                                className="p-2 hover:bg-telegram-hover rounded-lg"
                            >
                                <svg className="w-5 h-5 text-telegram-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="h-[calc(100%-60px)]">
                            <TeamsPanel onGroupCreated={loadGroups} />
                        </div>
                    </div>
                </div>
            )}
        </aside>
    )
}