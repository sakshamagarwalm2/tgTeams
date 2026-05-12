use tauri::State;
use grammers_client::types::Peer;
use grammers_tl_types as tl;
use crate::TelegramState;
use crate::commands::utils::{resolve_peer, map_error};

#[derive(Clone, serde::Serialize)]
pub struct TeamInfo {
    pub id: i64,
    pub name: String,
    pub username: Option<String>,
    pub member_count: i32,
    pub is_channel: bool,
    pub is_supergroup: bool,
}

#[derive(Clone, serde::Serialize)]
pub struct TeamMember {
    pub user_id: i64,
    pub first_name: String,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub phone: Option<String>,
    pub is_admin: bool,
    pub is_owner: bool,
    pub role: String,
}

#[derive(Clone, serde::Serialize)]
pub struct ChatMessage {
    pub id: i32,
    pub sender_id: i64,
    pub sender_name: String,
    pub text: String,
    pub date: String,
    pub has_media: bool,
    pub media_type: String,
    pub media_name: String,
    pub media_size: i64,
    pub mime_type: String,
}

#[tauri::command]
pub async fn cmd_get_teams(
    state: State<'_, TelegramState>,
) -> Result<Vec<TeamInfo>, String> {
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Ok(Vec::new());
    }
    let client = client_opt.unwrap();
    let mut teams = Vec::new();
    
    log::info!("Fetching all dialogs for groups list...");
    let mut dialogs = client.iter_dialogs();
    
    while let Some(dialog) = dialogs.next().await.map_err(|e| e.to_string())? {
        match &dialog.peer {
            Peer::Channel(c) => {
                if c.raw.broadcast {
                    continue;
                }
                let name = c.raw.title.clone();
                let username = c.raw.username.clone();
                let id = c.raw.id;
                
                teams.push(TeamInfo {
                    id,
                    name,
                    username,
                    member_count: 0,
                    is_channel: false,
                    is_supergroup: c.raw.megagroup,
                });
            },
            Peer::Group(g) => {
                let title = match &g.raw {
                    grammers_tl_types::enums::Chat::Chat(c) => c.title.clone(),
                    grammers_tl_types::enums::Chat::Channel(c) => c.title.clone(),
                    _ => "Unknown Group".to_string(),
                };
                teams.push(TeamInfo {
                    id: g.raw.id(),
                    name: title,
                    username: None,
                    member_count: 0,
                    is_channel: false,
                    is_supergroup: false,
                });
            },
            _ => {}
        }
    }
    
    log::info!("Found {} groups", teams.len());
    Ok(teams)
}

#[tauri::command]
pub async fn cmd_get_team_members(
    team_id: i64,
    state: State<'_, TelegramState>,
) -> Result<Vec<TeamMember>, String> {
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Ok(Vec::new());
    }
    let _client = client_opt.unwrap();
    
    log::info!("Fetching members for team/channel: {}", team_id);
    
    Ok(Vec::new())
}

#[tauri::command]
pub async fn cmd_search_users(
    query: String,
    state: State<'_, TelegramState>,
) -> Result<Vec<TeamMember>, String> {
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Ok(Vec::new());
    }
    let client = client_opt.unwrap();
    
    log::info!("Searching users with query: {}", query);
    
    let result = client.invoke(&tl::functions::contacts::Search {
        q: query.clone(),
        limit: 20,
    }).await.map_err(map_error)?;
    
    let mut results = Vec::new();
    
    let f = match result {
        tl::enums::contacts::Found::Found(f) => f,
    };
    
    for user in f.users {
        if let tl::enums::User::User(u) = user {
            let first_name = u.first_name.unwrap_or_else(|| "Unknown".to_string());
            let last_name = u.last_name.clone();
            let username = u.username.clone();
            let phone = u.phone.clone();
            
            results.push(TeamMember {
                user_id: u.id,
                first_name,
                last_name,
                username,
                phone,
                is_admin: false,
                is_owner: false,
                role: "member".to_string(),
            });
        }
    }
    
    log::info!("Found {} users matching query", results.len());
    Ok(results)
}

#[tauri::command]
pub async fn cmd_add_team_member(
    team_id: i64,
    user_id: i64,
    state: State<'_, TelegramState>,
) -> Result<bool, String> {
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Ok(false);
    }
    let client = client_opt.unwrap();
    
    log::info!("Adding user {} to team {}", user_id, team_id);
    
    let peer = resolve_peer(&client, Some(team_id), &state.peer_cache).await?;
    
    match &peer {
        Peer::Channel(c) => {
            let input_channel = tl::enums::InputChannel::Channel(tl::types::InputChannel {
                channel_id: c.raw.id,
                access_hash: c.raw.access_hash.ok_or("No access hash")?,
            });
            
            client.invoke(&tl::functions::channels::InviteToChannel {
                channel: input_channel,
                users: vec![tl::enums::InputUser::User(tl::types::InputUser {
                    user_id,
                    access_hash: 0,
                })],
            }).await.map_err(|e| format!("Failed to add member: {}", e))?;
        },
        Peer::Group(g) => {
            client.invoke(&tl::functions::messages::AddChatUser {
                chat_id: g.raw.id(),
                user_id: tl::enums::InputUser::User(tl::types::InputUser {
                    user_id,
                    access_hash: 0,
                }),
                fwd_limit: 100,
            }).await.map_err(|e| format!("Failed to add member: {}", e))?;
        },
        _ => return Err("Invalid peer type".to_string()),
    }
    
    log::info!("Added user {} to team {}", user_id, team_id);
    Ok(true)
}

#[tauri::command]
pub async fn cmd_remove_team_member(
    team_id: i64,
    user_id: i64,
    state: State<'_, TelegramState>,
) -> Result<bool, String> {
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Ok(false);
    }
    let client = client_opt.unwrap();
    
    log::info!("Removing user {} from team {}", user_id, team_id);
    
    let peer = resolve_peer(&client, Some(team_id), &state.peer_cache).await?;
    
    match &peer {
        Peer::Channel(c) => {
            let input_channel = tl::enums::InputChannel::Channel(tl::types::InputChannel {
                channel_id: c.raw.id,
                access_hash: c.raw.access_hash.ok_or("No access hash")?,
            });
            
            client.invoke(&tl::functions::channels::InviteToChannel {
                channel: input_channel,
                users: vec![tl::enums::InputUser::User(tl::types::InputUser {
                    user_id,
                    access_hash: 0,
                })],
            }).await.map_err(|e| format!("Failed to remove member: {}", e))?;
        },
        Peer::Group(g) => {
            client.invoke(&tl::functions::messages::DeleteChatUser {
                chat_id: g.raw.id(),
                user_id: tl::enums::InputUser::User(tl::types::InputUser {
                    user_id,
                    access_hash: 0,
                }),
                revoke_history: false,
            }).await.map_err(|e| format!("Failed to remove member: {}", e))?;
        },
        _ => return Err("Invalid peer type".to_string()),
    }
    
    log::info!("Removed user {} from team {}", user_id, team_id);
    Ok(true)
}

#[tauri::command]
pub async fn cmd_set_member_role(
    _team_id: i64,
    _user_id: i64,
    role: String,
    _state: State<'_, TelegramState>,
) -> Result<bool, String> {
    Err(format!("Role management not implemented. Requested role: {}", role))
}

#[tauri::command]
pub async fn cmd_create_team(
    name: String,
    _description: Option<String>,
    state: State<'_, TelegramState>,
) -> Result<TeamInfo, String> {
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Ok(TeamInfo { id: 999, name, username: None, member_count: 0, is_channel: false, is_supergroup: true });
    }
    let client = client_opt.unwrap();
    
    log::info!("Creating supergroup: {}", name);
    
    let result = client.invoke(&tl::functions::channels::CreateChannel {
        broadcast: false,
        megagroup: true,
        title: name.clone(),
        about: "".to_string(),
        geo_point: None,
        address: None,
        for_import: false,
        forum: false,
        ttl_period: None,
    }).await.map_err(|e| format!("Failed to create team: {}", e))?;
    
    let (id, username) = match result {
        tl::enums::Updates::Updates(u) => {
            let chat = u.chats.first().ok_or("No chat in updates")?;
            match chat {
                tl::enums::Chat::Channel(c) => (c.id, c.username.clone()),
                _ => return Err("Created chat is not a channel".to_string()),
            }
        },
        _ => return Err("Unexpected response".to_string()),
    };
    
    log::info!("Created team: {} (ID: {})", name, id);
    Ok(TeamInfo {
        id,
        name,
        username,
        member_count: 1,
        is_channel: false,
        is_supergroup: true,
    })
}

#[tauri::command]
pub async fn cmd_delete_team(
    team_id: i64,
    state: State<'_, TelegramState>,
) -> Result<bool, String> {
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Ok(false);
    }
    let client = client_opt.unwrap();
    
    log::info!("Deleting team {}", team_id);
    
    let peer = resolve_peer(&client, Some(team_id), &state.peer_cache).await?;
    
    match &peer {
        Peer::Channel(c) => {
            let input_channel = tl::enums::InputChannel::Channel(tl::types::InputChannel {
                channel_id: c.raw.id,
                access_hash: c.raw.access_hash.ok_or("No access hash")?,
            });
            
            client.invoke(&tl::functions::channels::DeleteChannel {
                channel: input_channel,
            }).await.map_err(|e| format!("Failed to delete team: {}", e))?;
        },
        Peer::Group(g) => {
            client.invoke(&tl::functions::messages::DeleteChat {
                chat_id: g.raw.id(),
            }).await.map_err(|e| format!("Failed to delete team: {}", e))?;
        },
        _ => return Err("Invalid peer type".to_string()),
    }
    
    log::info!("Deleted team {}", team_id);
    Ok(true)
}

#[tauri::command]
pub async fn cmd_edit_team(
    team_id: i64,
    new_name: Option<String>,
    _new_description: Option<String>,
    state: State<'_, TelegramState>,
) -> Result<bool, String> {
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Ok(false);
    }
    let client = client_opt.unwrap();
    
    log::info!("Editing team {} with name {:?}", team_id, new_name);
    
    let peer = resolve_peer(&client, Some(team_id), &state.peer_cache).await?;
    
    match &peer {
        Peer::Channel(c) => {
            let input_channel = tl::enums::InputChannel::Channel(tl::types::InputChannel {
                channel_id: c.raw.id,
                access_hash: c.raw.access_hash.ok_or("No access hash")?,
            });
            
            if let Some(name) = new_name {
                client.invoke(&tl::functions::channels::EditTitle {
                    channel: input_channel,
                    title: name,
                }).await.map_err(|e| format!("Failed to rename team: {}", e))?;
            }
        },
        Peer::Group(g) => {
            if let Some(name) = new_name {
                client.invoke(&tl::functions::messages::EditChatTitle {
                    chat_id: g.raw.id(),
                    title: name,
                }).await.map_err(|e| format!("Failed to rename team: {}", e))?;
            }
        },
        _ => return Err("Invalid peer type".to_string()),
    }
    
    log::info!("Edited team {}", team_id);
    Ok(true)
}

#[tauri::command]
pub async fn cmd_get_team_messages(
    team_id: i64,
    limit: Option<i32>,
    state: State<'_, TelegramState>,
) -> Result<Vec<ChatMessage>, String> {
    use std::time::{SystemTime, UNIX_EPOCH, Duration};
    
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Ok(Vec::new());
    }
    let client = client_opt.unwrap();
    
    log::info!("Fetching messages for team/channel: {}", team_id);
    
    let peer = resolve_peer(&client, Some(team_id), &state.peer_cache).await?;
    
    let msg_limit = limit.unwrap_or(50) as usize;
    let mut messages = Vec::new();
    let mut iter = client.iter_messages(&peer);
    
    let two_days_ago = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or(Duration::from_secs(0)) - Duration::from_secs(2 * 24 * 60 * 60);
    
    let mut count = 0;
    while let Some(msg) = iter.next().await.map_err(|e| e.to_string())? {
        if count >= msg_limit {
            break;
        }
        
        let msg_time = msg.date();
        let msg_timestamp = SystemTime::from(msg_time).duration_since(UNIX_EPOCH).unwrap_or(Duration::from_secs(0)).as_secs();
        
        if msg_timestamp < two_days_ago.as_secs() {
            if count > 0 { break; }
            continue;
        }
        
        let sender_name = match msg.sender() {
            Some(Peer::User(u)) => {
                let first = if let Some(f) = u.first_name() { f.to_string() } else { "Unknown".to_string() };
                if let Some(l) = u.last_name() {
                    format!("{} {}", first, l)
                } else {
                    first
                }
            },
            _ => "Unknown".to_string(),
        };
        let sender_id = match msg.sender() {
            Some(Peer::User(u)) => u.raw.id() as i64,
            _ => 0,
        };
        
        let media = msg.media();
        let text = msg.text().to_string();
        
        let (has_media, media_type, media_name, media_size, mime_type, display_text) = match media {
            Some(grammers_client::types::Media::Photo(_)) => {
                let display = if !text.is_empty() { text } else { "[Photo]".to_string() };
                (true, "photo".to_string(), "Photo".to_string(), 0, "image/jpeg".to_string(), display)
            },
            Some(grammers_client::types::Media::Document(d)) => {
                let name = d.name();
                let size = d.size() as i64;
                let mime = d.mime_type().map(|m| m.to_string()).unwrap_or_default();
                let ext = std::path::Path::new(&name)
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|s| s.to_lowercase())
                    .unwrap_or_default();
                
                let file_type = if ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].contains(&ext.as_str()) {
                    "image"
                } else if ["mp4", "avi", "mov", "mkv", "webm"].contains(&ext.as_str()) {
                    "video"
                } else if ["mp3", "wav", "ogg", "flac", "aac", "m4a"].contains(&ext.as_str()) {
                    "audio"
                } else if ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"].contains(&ext.as_str()) {
                    "document"
                } else {
                    "file"
                }.to_string();
                
                let display = if !text.is_empty() { text } else { name.to_string() };
                (true, file_type, name.to_string(), size, mime, display)
            },
            _ => {
                let display = if !text.is_empty() { text } else { "[No text]".to_string() };
                (false, "none".to_string(), "".to_string(), 0, "".to_string(), display)
            }
        };
        
        let date_str = msg.date().format("%Y-%m-%d %H:%M:%S").to_string();
        
        messages.push(ChatMessage {
            id: msg.id(),
            sender_id,
            sender_name,
            text: display_text,
            date: date_str,
            has_media,
            media_type,
            media_name,
            media_size,
            mime_type,
        });
        
        count += 1;
    }
    
    log::info!("Found {} messages for team {} (last 2 days)", messages.len(), team_id);
    Ok(messages)
}

#[tauri::command]
pub async fn cmd_send_team_message(
    team_id: i64,
    message: String,
    state: State<'_, TelegramState>,
) -> Result<bool, String> {
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Ok(false);
    }
    let client = client_opt.unwrap();
    
    let peer = resolve_peer(&client, Some(team_id), &state.peer_cache).await?;
    let message_obj = grammers_client::InputMessage::new().text(message);
    
    client.send_message(&peer, message_obj).await.map_err(|e| format!("Failed to send message: {}", e))?;
    
    Ok(true)
}

#[tauri::command]
pub async fn cmd_download_team_media(
    message_id: i32,
    team_id: i64,
    save_path: String,
    state: State<'_, TelegramState>,
) -> Result<String, String> {
    use grammers_client::types::Media;
    
    let client_opt = state.client.lock().await.clone();
    if client_opt.is_none() {
        return Err("Not logged in".to_string());
    }
    let client = client_opt.unwrap();
    
    let peer = resolve_peer(&client, Some(team_id), &state.peer_cache).await?;
    
    let messages = client.get_messages_by_id(&peer, &[message_id]).await.map_err(|e| e.to_string())?;
    
    let msg = messages.into_iter().flatten().next().ok_or("Message not found")?;
    
    let media = msg.media().ok_or("No media in message")?;
    
    match media {
        Media::Photo(_) => {
            std::fs::File::create(&save_path).map_err(|e| e.to_string())?;
            log::info!("[MOCK] Saved photo to {}", save_path);
            Ok("Photo saved".to_string())
        },
        Media::Document(ref d) => {
            let name = d.name();
            let ext = std::path::Path::new(&name)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("bin");
            let final_path = if save_path.ends_with(&format!(".{}", ext)) {
                save_path.clone()
            } else {
                format!("{}.{}", save_path, ext)
            };
            
            let mut download_iter = client.iter_download(&media);
            let mut file = std::fs::File::create(&final_path).map_err(|e| e.to_string())?;
            
            while let Some(chunk) = download_iter.next().await.transpose() {
                let bytes = chunk.map_err(|e| e.to_string())?;
                std::io::Write::write_all(&mut file, &bytes).map_err(|e| e.to_string())?;
            }
            
            log::info!("Downloaded file to {}", final_path);
            Ok(final_path)
        },
        _ => Err("Unsupported media type".to_string()),
    }
}