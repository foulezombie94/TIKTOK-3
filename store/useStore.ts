import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  username: string
  display_name: string
  avatar_url: string
}

interface StoreState {
  isMuted: boolean
  setIsMuted: (muted: boolean) => void
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
  showAuthModal: boolean
  setShowAuthModal: (show: boolean) => void
  isAuthLoading: boolean
  setIsAuthLoading: (loading: boolean) => void
  
  // Inbox counters
  unreadMessagesCount: number
  setUnreadMessagesCount: (count: number) => void
  unreadNotificationsCount: number
  setUnreadNotificationsCount: (count: number) => void
  
  // Cache global pour les abonnements
  followedUsers: Record<string, boolean>
  setFollowedUser: (userId: string, isFollowing: boolean) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      isMuted: true,
      setIsMuted: (isMuted) => set({ isMuted }),
      currentUser: null,
      setCurrentUser: (currentUser) => set({ currentUser }),
      showAuthModal: false,
      setShowAuthModal: (showAuthModal) => set({ showAuthModal }),
      isAuthLoading: true,
      setIsAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
      
      unreadMessagesCount: 0,
      setUnreadMessagesCount: (unreadMessagesCount) => set({ unreadMessagesCount }),
      unreadNotificationsCount: 0,
      setUnreadNotificationsCount: (unreadNotificationsCount) => set({ unreadNotificationsCount }),
      
      followedUsers: {},
      setFollowedUser: (userId, isFollowing) => 
        set((state) => ({
          followedUsers: { ...state.followedUsers, [userId]: isFollowing }
        })),
    }),
    {
      name: 'tiktok-storage',
      partialize: (state) => ({ 
        isMuted: state.isMuted,
        currentUser: state.currentUser,
        followedUsers: state.followedUsers,
      }),
    }
  )
)
