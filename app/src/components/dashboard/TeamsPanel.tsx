import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Users, Plus, Trash2, UserPlus, UserMinus, Search, X, ChevronRight, MessageSquare, Send, Image } from 'lucide-react';
import { toast } from 'sonner';

interface TeamInfo {
    id: number;
    name: string;
    username: string | null;
    member_count: number;
    is_channel: boolean;
    is_supergroup: boolean;
}

interface TeamMember {
    user_id: number;
    first_name: string;
    last_name: string | null;
    username: string | null;
    phone: string | null;
    is_admin: boolean;
    is_owner: boolean;
    role: string;
}

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

interface TeamsPanelProps {
    onGroupCreated?: () => void;
}

export function TeamsPanel({ onGroupCreated }: TeamsPanelProps) {
    const [teams, setTeams] = useState<TeamInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState<TeamInfo | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<TeamMember[]>([]);
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDesc, setNewTeamDesc] = useState('');
    const [activeTab, setActiveTab] = useState<'members' | 'chats'>('members');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');

    useEffect(() => {
        loadTeams();
    }, []);

    const loadTeams = async () => {
        try {
            setLoading(true);
            const result = await invoke<TeamInfo[]>('cmd_get_teams');
            setTeams(result);
        } catch (e) {
            toast.error('Failed to load teams');
        } finally {
            setLoading(false);
        }
    };

    const loadMembers = async (teamId: number) => {
        try {
            setMembersLoading(true);
            const result = await invoke<TeamMember[]>('cmd_get_team_members', { teamId });
            setMembers(result);
        } catch (e) {
            toast.error('Failed to load members');
        } finally {
            setMembersLoading(false);
        }
    };

    const handleSelectTeam = (team: TeamInfo) => {
        setSelectedTeam(team);
        loadMembers(team.id);
        loadMessages(team.id);
    };

    const loadMessages = async (teamId: number) => {
        try {
            setMessagesLoading(true);
            const result = await invoke<ChatMessage[]>('cmd_get_team_messages', { teamId });
            setMessages(result);
        } catch (e) {
            toast.error('Failed to load messages');
        } finally {
            setMessagesLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!selectedTeam || !newMessage.trim()) return;
        try {
            await invoke('cmd_send_team_message', {
                teamId: selectedTeam.id,
                message: newMessage,
            });
            setNewMessage('');
            loadMessages(selectedTeam.id);
            toast.success('Message sent');
        } catch (e) {
            toast.error(`Failed to send message: ${e}`);
        }
    };

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) {
            toast.error('Team name is required');
            return;
        }
        try {
            await invoke('cmd_create_team', {
                name: newTeamName,
                description: newTeamDesc || null,
            });
            toast.success('Team created successfully');
            setShowCreateModal(false);
            setNewTeamName('');
            setNewTeamDesc('');
            loadTeams();
            onGroupCreated?.();
        } catch (e) {
            toast.error(`Failed to create team: ${e}`);
        }
    };

    const handleDeleteTeam = async (teamId: number) => {
        if (!confirm('Are you sure you want to delete this team?')) return;
        try {
            await invoke('cmd_delete_team', { teamId });
            toast.success('Team deleted');
            if (selectedTeam?.id === teamId) setSelectedTeam(null);
            loadTeams();
        } catch (e) {
            toast.error(`Failed to delete team: ${e}`);
        }
    };

    const handleEditTeam = async () => {
        if (!selectedTeam || !newTeamName.trim()) return;
        try {
            await invoke('cmd_edit_team', {
                teamId: selectedTeam.id,
                newName: newTeamName,
                newDescription: newTeamDesc || null,
            });
            toast.success('Team updated');
            setShowEditModal(false);
            loadTeams();
            if (selectedTeam) {
                setSelectedTeam({ ...selectedTeam, name: newTeamName });
            }
        } catch (e) {
            toast.error(`Failed to update team: ${e}`);
        }
    };

    const handleSearchUsers = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const results = await invoke<TeamMember[]>('cmd_search_users', { query });
            setSearchResults(results);
        } catch (e) {
            toast.error('Search failed');
        }
    };

    const handleAddMember = async (userId: number) => {
        if (!selectedTeam) return;
        try {
            await invoke('cmd_add_team_member', { teamId: selectedTeam.id, userId });
            toast.success('Member added');
            setShowAddMemberModal(false);
            setSearchQuery('');
            setSearchResults([]);
            loadMembers(selectedTeam.id);
        } catch (e) {
            toast.error(`Failed to add member: ${e}`);
        }
    };

    const handleRemoveMember = async (userId: number) => {
        if (!selectedTeam) return;
        try {
            await invoke('cmd_remove_team_member', { teamId: selectedTeam.id, userId });
            toast.success('Member removed');
            loadMembers(selectedTeam.id);
        } catch (e) {
            toast.error(`Failed to remove member: ${e}`);
        }
    };

    return (
        <div className="flex h-full">
            {/* Teams List */}
            <div className="w-80 border-r border-telegram-border flex flex-col">
                <div className="p-4 border-b border-telegram-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-telegram-primary" />
                        <h2 className="font-semibold text-telegram-text">Teams</h2>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="p-2 hover:bg-telegram-hover rounded-lg transition-colors"
                    >
                        <Plus className="w-5 h-5 text-telegram-primary" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="p-4 text-telegram-subtext text-center">Loading teams...</div>
                    ) : teams.length === 0 ? (
                        <div className="p-4 text-telegram-subtext text-center">No teams found</div>
                    ) : (
                        <div className="p-2">
                            {teams.map((team) => (
                                <div
                                    key={team.id}
                                    onClick={() => handleSelectTeam(team)}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                        selectedTeam?.id === team.id
                                            ? 'bg-telegram-primary/10 border border-telegram-primary/20'
                                            : 'hover:bg-telegram-hover'
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-telegram-primary/20 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-telegram-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-telegram-text truncate">{team.name}</p>
                                        <p className="text-xs text-telegram-subtext">
                                            {team.member_count} members
                                            {team.username && ` • @${team.username}`}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-telegram-subtext" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Team Details */}
            <div className="flex-1 flex flex-col">
                {selectedTeam ? (
                    <>
                        <div className="p-4 border-b border-telegram-border flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-telegram-text">{selectedTeam.name}</h2>
                                <p className="text-sm text-telegram-subtext">
                                    {selectedTeam.member_count} members
                                    {selectedTeam.username && ` • @${selectedTeam.username}`}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setNewTeamName(selectedTeam.name);
                                        setNewTeamDesc('');
                                        setShowEditModal(true);
                                    }}
                                    className="p-2 hover:bg-telegram-hover rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5 text-telegram-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleDeleteTeam(selectedTeam.id)}
                                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-5 h-5 text-red-500" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 flex items-center justify-between">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setActiveTab('members')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                        activeTab === 'members'
                                            ? 'bg-telegram-primary text-white'
                                            : 'text-telegram-subtext hover:bg-telegram-hover'
                                    }`}
                                >
                                    <Users className="w-4 h-4" />
                                    Members ({members.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('chats')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                        activeTab === 'chats'
                                            ? 'bg-telegram-primary text-white'
                                            : 'text-telegram-subtext hover:bg-telegram-hover'
                                    }`}
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Chats ({messages.length})
                                </button>
                            </div>
                            {activeTab === 'members' && (
                                <button
                                    onClick={() => setShowAddMemberModal(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-telegram-primary text-white rounded-lg text-sm hover:bg-telegram-primary/90 transition-colors"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Add Member
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto px-4 pb-4">
                            {activeTab === 'members' ? (
                                <MembersList members={members} membersLoading={membersLoading} onRemove={handleRemoveMember} />
                            ) : (
                                <ChatsList messages={messages} messagesLoading={messagesLoading} />
                            )}
                        </div>

                        {activeTab === 'chats' && (
                            <div className="p-4 border-t border-telegram-border">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                        placeholder="Type a message..."
                                        className="flex-1 px-3 py-2 bg-telegram-hover rounded-lg text-telegram-text border border-telegram-border focus:border-telegram-primary outline-none"
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim()}
                                        className="p-2 bg-telegram-primary text-white rounded-lg hover:bg-telegram-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-telegram-subtext">
                        Select a team to view details
                    </div>
                )}
            </div>

            {/* Create Team Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-telegram-surface rounded-xl p-6 w-96 border border-telegram-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-telegram-text">Create New Team</h3>
                            <button onClick={() => setShowCreateModal(false)}>
                                <X className="w-5 h-5 text-telegram-subtext" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-telegram-subtext mb-1">Team Name</label>
                                <input
                                    type="text"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    className="w-full px-3 py-2 bg-telegram-hover rounded-lg text-telegram-text border border-telegram-border focus:border-telegram-primary outline-none"
                                    placeholder="Enter team name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-telegram-subtext mb-1">Description (optional)</label>
                                <textarea
                                    value={newTeamDesc}
                                    onChange={(e) => setNewTeamDesc(e.target.value)}
                                    className="w-full px-3 py-2 bg-telegram-hover rounded-lg text-telegram-text border border-telegram-border focus:border-telegram-primary outline-none resize-none"
                                    rows={3}
                                    placeholder="Enter team description"
                                />
                            </div>
                            <button
                                onClick={handleCreateTeam}
                                className="w-full py-2 bg-telegram-primary text-white rounded-lg hover:bg-telegram-primary/90 transition-colors"
                            >
                                Create Team
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Team Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-telegram-surface rounded-xl p-6 w-96 border border-telegram-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-telegram-text">Edit Team</h3>
                            <button onClick={() => setShowEditModal(false)}>
                                <X className="w-5 h-5 text-telegram-subtext" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-telegram-subtext mb-1">Team Name</label>
                                <input
                                    type="text"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    className="w-full px-3 py-2 bg-telegram-hover rounded-lg text-telegram-text border border-telegram-border focus:border-telegram-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-telegram-subtext mb-1">Description</label>
                                <textarea
                                    value={newTeamDesc}
                                    onChange={(e) => setNewTeamDesc(e.target.value)}
                                    className="w-full px-3 py-2 bg-telegram-hover rounded-lg text-telegram-text border border-telegram-border focus:border-telegram-primary outline-none resize-none"
                                    rows={3}
                                />
                            </div>
                            <button
                                onClick={handleEditTeam}
                                className="w-full py-2 bg-telegram-primary text-white rounded-lg hover:bg-telegram-primary/90 transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {showAddMemberModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-telegram-surface rounded-xl p-6 w-96 border border-telegram-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-telegram-text">Add Member</h3>
                            <button onClick={() => setShowAddMemberModal(false)}>
                                <X className="w-5 h-5 text-telegram-subtext" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-telegram-subtext" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchUsers(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 bg-telegram-hover rounded-lg text-telegram-text border border-telegram-border focus:border-telegram-primary outline-none"
                                    placeholder="Search users..."
                                />
                            </div>
                            {searchResults.length > 0 && (
                                <div className="max-h-64 overflow-auto space-y-2">
                                    {searchResults.map((user) => (
                                        <div
                                            key={user.user_id}
                                            onClick={() => handleAddMember(user.user_id)}
                                            className="flex items-center gap-3 p-3 bg-telegram-hover rounded-lg cursor-pointer hover:bg-telegram-primary/10 transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-telegram-primary/20 flex items-center justify-center">
                                                <span className="text-xs font-medium text-telegram-primary">
                                                    {user.first_name[0]}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-sm text-telegram-text">
                                                    {user.first_name} {user.last_name || ''}
                                                </p>
                                                <p className="text-xs text-telegram-subtext">
                                                    {user.username || user.phone || ''}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface MembersListProps {
    members: TeamMember[];
    membersLoading: boolean;
    onRemove: (userId: number) => void;
}

function MembersList({ members, membersLoading, onRemove }: MembersListProps) {
    if (membersLoading) {
        return <div className="text-center text-telegram-subtext py-8">Loading members...</div>;
    }
    if (members.length === 0) {
        return <div className="text-center text-telegram-subtext py-8">No members found</div>;
    }
    return (
        <div className="space-y-2">
            {members.map((member) => (
                <div
                    key={member.user_id}
                    className="flex items-center gap-4 p-3 bg-telegram-surface rounded-lg border border-telegram-border"
                >
                    <div className="w-10 h-10 rounded-full bg-telegram-primary/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-telegram-primary">
                            {member.first_name[0]}
                        </span>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-telegram-text">
                                {member.first_name} {member.last_name || ''}
                            </p>
                            {member.is_owner && (
                                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded-full">Owner</span>
                            )}
                            {member.is_admin && !member.is_owner && (
                                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-500 text-xs rounded-full">Admin</span>
                            )}
                        </div>
                        <p className="text-xs text-telegram-subtext">
                            {member.username || member.phone || 'No username'}
                        </p>
                    </div>
                    {!member.is_owner && (
                        <button
                            onClick={() => onRemove(member.user_id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <UserMinus className="w-4 h-4 text-red-500" />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

interface ChatsListProps {
    messages: ChatMessage[];
    messagesLoading: boolean;
}

function ChatsList({ messages, messagesLoading }: ChatsListProps) {
    if (messagesLoading) {
        return <div className="text-center text-telegram-subtext py-8">Loading messages...</div>;
    }
    if (messages.length === 0) {
        return <div className="text-center text-telegram-subtext py-8">No messages yet</div>;
    }
    return (
        <div className="space-y-3">
            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className="p-4 bg-telegram-surface rounded-lg border border-telegram-border"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-telegram-primary/20 flex items-center justify-center">
                            <span className="text-xs font-medium text-telegram-primary">
                                {msg.sender_name[0]}
                            </span>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-telegram-text">{msg.sender_name}</p>
                            <p className="text-xs text-telegram-subtext">{new Date(msg.date).toLocaleString()}</p>
                        </div>
                        {msg.has_media && (
                            <div className="flex items-center gap-1 text-telegram-subtext">
                                <Image className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-telegram-text whitespace-pre-wrap">{msg.text}</p>
                </div>
            ))}
        </div>
    );
}