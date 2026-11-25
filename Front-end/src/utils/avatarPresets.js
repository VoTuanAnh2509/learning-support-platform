export const AVATAR_PRESETS = [
  { id: '', label: 'Initials', emoji: '', bg: '#d8ed91' },
  { id: 'coder', label: 'Dev Coder', emoji: '👨‍💻', bg: '#d8ed91' },
  { id: 'rocket', label: 'Rocket', emoji: '🚀', bg: '#bae6fd' },
  { id: 'lightning', label: 'JS Bolt', emoji: '⚡', bg: '#fef08a' },
  { id: 'robot', label: 'AI Bot', emoji: '🤖', bg: '#e9d5ff' },
  { id: 'shield', label: 'Cyber Shield', emoji: '🛡️', bg: '#bbf7d0' },
  { id: 'fire', label: 'Code Streak', emoji: '🔥', bg: '#fed7aa' },
  { id: 'gem', label: 'Full-Stack', emoji: '💎', bg: '#c7d2fe' },
]

export function getAvatarPreset(presetId) {
  if (!presetId) return null
  return AVATAR_PRESETS.find(item => item.id === presetId) || null
}
