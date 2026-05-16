import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

import { TelegramFile, BandwidthStats } from '../types';
import { formatBytes } from '../utils';

import { Search, Loader2, Plus } from 'lucide-react';

// Components
import { Sidebar } from './dashboard/Sidebar';
import { TopBar } from './dashboard/TopBar';
import { FileExplorer } from './dashboard/FileExplorer';
import { TeamChat } from './dashboard/TeamChat';
import { MemberStack } from './dashboard/MemberStack';
import { AddSubscriberModal } from './dashboard/AddSubscriberModal';
import { UploadQueue } from './dashboard/UploadQueue';
import { DownloadQueue } from './dashboard/DownloadQueue';
import { MoveToFolderModal } from './dashboard/MoveToFolderModal';
import { DragDropOverlay } from './dashboard/DragDropOverlay';
import { ExternalDropBlocker } from './dashboard/ExternalDropBlocker';

// Hooks
import { useTelegramConnection } from '../hooks/useTelegramConnection';
import { useFileOperations } from '../hooks/useFileOperations';
import { useFileUpload } from '../hooks/useFileUpload';
import { useFileDownload } from '../hooks/useFileDownload';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export function Dashboard({ onLogout }: { onLogout: () => void }) {
    const queryClient = useQueryClient();

    const {
        store, folders, activeFolderId, setActiveFolderId, isSyncing, isConnected,
        handleLogout, handleSyncFolders, handleCreateFolder, handleFolderRename, handleFolderDelete
    } = useTelegramConnection(onLogout);

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<TelegramFile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [internalDragFileId, _setInternalDragFileId] = useState<number | null>(null);
    const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
    const [groups, setGroups] = useState<{id: number, name: string, username: string | null, member_count: number}[]>([]);
    const [activeMembers, setActiveMembers] = useState<any[]>([]);
    const [showAddSubscriber, setShowAddSubscriber] = useState(false);
    const internalDragRef = useRef<number | null>(null);

    const loadGroups = async () => {
        try {
            const result = await invoke<{id: number, name: string, username: string | null, member_count: number}[]>('cmd_get_teams');
            setGroups(result);
        } catch (e) {
            console.error('Failed to load groups:', e);
        }
    };

    const loadActiveMembers = async (id: number | null) => {
        if (id === null) {
            setActiveMembers([]);
            return;
        }
        try {
            const result = await invoke<any[]>('cmd_get_team_members', { teamId: id });
            setActiveMembers(result);
        } catch (e) {
            console.error('Failed to load members:', e);
            setActiveMembers([]);
        }
    };

    useEffect(() => {
        loadGroups();
    }, []);

    useEffect(() => {
        loadActiveMembers(activeFolderId || activeGroupId);
    }, [activeFolderId, activeGroupId]);

    const setInternalDragFileId = (id: number | null) => {
        internalDragRef.current = id;
        _setInternalDragFileId(id);
    };

    useEffect(() => {
        if (store) {
            store.get<'grid' | 'list'>('viewMode').then((saved) => {
                if (saved) setViewMode(saved);
            });
        }
    }, [store]);

    useEffect(() => {
        if (store) {
            store.set('viewMode', viewMode).then(() => store.save());
        }
    }, [store, viewMode]);

    const { data: allFiles = [], isLoading, error } = useQuery({
        queryKey: ['files', activeFolderId],
        queryFn: () => invoke<any[]>('cmd_get_files', { folderId: activeFolderId }).then(res => res.map(f => ({
            ...f,
            sizeStr: formatBytes(f.size),
            type: f.icon_type || (f.name.endsWith('/') ? 'folder' : 'file')
        }))),
        enabled: !!store,
    });

    const displayedFiles = searchTerm.length > 2
        ? searchResults
        : allFiles.filter((f: TelegramFile) => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const { data: bandwidth } = useQuery({
        queryKey: ['bandwidth'],
        queryFn: () => invoke<BandwidthStats>('cmd_get_bandwidth'),
        refetchInterval: 5000,
        enabled: !!store
    });

    const {
        handleDelete, handleRename, handleBulkDelete, handleBulkDownload,
        handleBulkMove, handleDownloadFolder, handleGlobalSearch
    } = useFileOperations(activeFolderId, selectedIds, setSelectedIds, displayedFiles);

    const { uploadQueue, setUploadQueue, handleManualUpload, cancelAll: cancelUploads, cancelItem: cancelUploadItem, retryItem: retryUploadItem, isDragging } = useFileUpload(activeFolderId, store);
    const { downloadQueue, queueDownload, clearFinished: clearDownloads, cancelAll: cancelDownloads, cancelItem: cancelDownloadItem, retryItem: retryDownloadItem, openWithSystemApp } = useFileDownload(store);

    const handleSelectAll = useCallback(() => {
        setSelectedIds(displayedFiles.map(f => f.id));
    }, [displayedFiles]);

    const handleKeyboardDelete = useCallback(() => {
        if (selectedIds.length > 0) {
            handleBulkDelete();
        }
    }, [selectedIds, handleBulkDelete]);

    const handleEscape = useCallback(() => {
        setSelectedIds([]);
        setSearchTerm("");
    }, []);

    const handleFocusSearch = useCallback(() => {
        const searchInput = document.querySelector('input[placeholder="Search files..."]') as HTMLInputElement;
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }, []);

    const handleEnter = useCallback(() => {
        if (selectedIds.length === 1) {
            const selected = displayedFiles.find(f => f.id === selectedIds[0]);
            if (selected && selected.type !== 'folder') {
                openWithSystemApp(selected.id, selected.name, activeFolderId);
            }
        }
    }, [selectedIds, displayedFiles, activeFolderId, openWithSystemApp]);

    useKeyboardShortcuts({
        onSelectAll: handleSelectAll,
        onDelete: handleKeyboardDelete,
        onEscape: handleEscape,
        onSearch: handleFocusSearch,
        onEnter: handleEnter,
        enabled: !showMoveModal
    });

    useEffect(() => {
        setSelectedIds([]);
        setShowMoveModal(false);
        setSearchTerm("");
        setSearchResults([]);
    }, [activeFolderId]);

    useEffect(() => {
        if (searchTerm.length <= 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            const results = await handleGlobalSearch(searchTerm);
            setSearchResults(results);
            setIsSearching(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleFileClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey) {
            setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
        } else {
            setSelectedIds([id]);
        }
    }

    const handleToggleSelection = useCallback((id: number) => {
        setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
    }, []);

    const handleOpenFile = (file: TelegramFile) => {
        if (file.type !== 'folder') {
            openWithSystemApp(file.id, file.name, activeFolderId);
        }
    };

    const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: number | null) => {
        e.preventDefault();
        e.stopPropagation();

        const dataTransferFileId = e.dataTransfer.getData("application/x-telegram-file-id");

        if (activeFolderId === targetFolderId) return;

        const fileId = internalDragRef.current || (dataTransferFileId ? parseInt(dataTransferFileId) : null);

        if (fileId) {
            try {
                const idsToMove = selectedIds.includes(fileId) ? selectedIds : [fileId];

                await invoke('cmd_move_files', {
                    messageIds: idsToMove,
                    sourceFolderId: activeFolderId,
                    targetFolderId: targetFolderId
                });

                queryClient.invalidateQueries({ queryKey: ['files', activeFolderId] });

                if (selectedIds.includes(fileId)) setSelectedIds([]);

                toast.success(`Moved ${idsToMove.length} file(s).`);

                setInternalDragFileId(null);
            } catch {
                toast.error(`Failed to move file(s).`);
            }
        }
    }

    const currentFolderName = activeFolderId === null
        ? "Saved Messages"
        : folders.find(f => f.id === activeFolderId)?.name || "Folder";

    const handleRootDragOver = (e: React.DragEvent) => {
        if (internalDragRef.current) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
        }
    };

    const handleRootDragEnter = (e: React.DragEvent) => {
        if (internalDragRef.current) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
        }
    };

    return (
        <div
            className="flex h-screen w-full overflow-hidden bg-telegram-bg relative"
            onClick={() => setSelectedIds([])}
            onDragOver={handleRootDragOver}
            onDragEnter={handleRootDragEnter}
        >
            <ExternalDropBlocker onUploadClick={handleManualUpload} />

            <AnimatePresence>
                {showMoveModal && (
                    <MoveToFolderModal
                        folders={folders}
                        onClose={() => setShowMoveModal(false)}
                        onSelect={handleBulkMove}
                        activeFolderId={activeFolderId}
                        key="move-modal"
                    />
                )}
                {isDragging && internalDragFileId === null && <DragDropOverlay key="drag-drop-overlay" />}
            </AnimatePresence>

            <Sidebar
                folders={folders}
                activeFolderId={activeFolderId}
                setActiveFolderId={setActiveFolderId}
                activeGroupId={activeGroupId}
                setActiveGroupId={setActiveGroupId}
                onDrop={handleDropOnFolder}
                onDelete={handleFolderDelete}
                onRename={handleFolderRename}
                onCreate={handleCreateFolder}
                isSyncing={isSyncing}
                isConnected={isConnected}
                onSync={handleSyncFolders}
                onLogout={handleLogout}
                bandwidth={bandwidth || null}
            />

            <main className="flex-1 flex flex-col overflow-hidden" onClick={(e) => { if (e.target === e.currentTarget) setSelectedIds([]); }}>
                {activeGroupId !== null ? (
                    <div className="flex-1 flex flex-col min-h-0 relative">
                        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                            <MemberStack members={activeMembers} size="sm" />
                            <button
                                onClick={() => setShowAddSubscriber(true)}
                                className="w-8 h-8 rounded-full bg-telegram-primary/10 hover:bg-telegram-primary/20 text-telegram-primary flex items-center justify-center transition-all shadow-sm active:scale-95"
                                title="Add Subscriber"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <TeamChat 
                            groupId={activeGroupId} 
                            groupName={groups.find(g => g.id === activeGroupId)?.name || 'Group Chat'}
                        />
                    </div>
                ) : (
                    <>
                        <TopBar
                            currentFolderName={currentFolderName}
                            selectedIds={selectedIds}
                            onShowMoveModal={() => setShowMoveModal(true)}
                            onBulkDownload={handleBulkDownload}
                            onBulkDelete={handleBulkDelete}
                            onDownloadFolder={handleDownloadFolder}
                            viewMode={viewMode}
                            setViewMode={setViewMode}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                            members={activeMembers}
                            onAddSubscriber={activeFolderId ? () => setShowAddSubscriber(true) : undefined}
                        />
                        {searchTerm.length > 2 && (
                            <div className="px-6 pt-4 pb-0">
                                <h2 className="text-sm font-medium text-telegram-subtext">
                                    Search Results for <span className="text-telegram-primary">"{searchTerm}"</span>
                                </h2>
                            </div>
                        )}
                        <FileExplorer
                            files={displayedFiles}
                            loading={isLoading || isSearching}
                            error={error}
                            viewMode={viewMode}
                            selectedIds={selectedIds}
                            activeFolderId={activeFolderId}
                            onFileClick={handleFileClick}
                            onDelete={handleDelete}
                            onRename={handleRename}
                            onDownload={(id, name) => queueDownload(id, name, activeFolderId)}
                            onOpen={handleOpenFile}
                            onManualUpload={handleManualUpload}
                            onSelectionClear={() => setSelectedIds([])}
                            onToggleSelection={handleToggleSelection}
                            onDrop={handleDropOnFolder}
                            onDragStart={(fileId) => setInternalDragFileId(fileId)}
                            onDragEnd={() => setTimeout(() => setInternalDragFileId(null), 50)}
                        />
                    </>
                )}
            </main>

            <UploadQueue
                items={uploadQueue}
                onClearFinished={() => setUploadQueue(q => q.filter(i => i.status !== 'success' && i.status !== 'error' && i.status !== 'cancelled'))}
                onCancelAll={cancelUploads}
                onCancelItem={cancelUploadItem}
                onRetryItem={retryUploadItem}
            />
            <DownloadQueue
                items={downloadQueue}
                onClearFinished={clearDownloads}
                onCancelAll={cancelDownloads}
                onCancelItem={cancelDownloadItem}
                onRetryItem={retryDownloadItem}
            />

            {showAddSubscriber && (activeFolderId || activeGroupId) && (
                <AddSubscriberModal
                    teamId={(activeFolderId || activeGroupId)!}
                    onClose={() => setShowAddSubscriber(false)}
                    onSuccess={() => loadActiveMembers(activeFolderId || activeGroupId)}
                />
            )}
        </div>
    );
}
