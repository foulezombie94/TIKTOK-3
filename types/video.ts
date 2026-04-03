export interface FeedVideo {
  id: string
  user_id: string
  video_url: string
  thumbnail_url?: string
  caption: string
  music_name: string
  views_count: number
  created_at: string
  slug: string
  users: {
    id: string
    username: string
    display_name: string
    avatar_url: string
    bio?: string
  }
  likes_count: number
  comments_count: number
  bookmarks_count: number
  user_has_liked?: boolean
  user_has_saved?: boolean
  user_is_following?: boolean
  // Support legacy/RPC calculated fields
  _userHasLiked?: boolean
  _userHasSaved?: boolean
  _userIsFollowing?: boolean
  likes?: { count: number }[]
  bookmarks?: { count: number }[]
  comments?: { count: number }[]
}
