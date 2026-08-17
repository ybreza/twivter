'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Camera, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/app-store'
import { apiPatch, apiPost } from '@/lib/hooks'
import { validateImageFile } from '@/lib/utils'
import type { ProfileDTO } from '@/lib/types'

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (profile: ProfileDTO) => void
}

const BUCKET_AVATARS = 'avatars'
const BUCKET_COVERS = 'covers'

export function EditProfileDialog({ open, onOpenChange, onSaved }: EditProfileDialogProps) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [website, setWebsite] = useState(user?.website ?? '')
  const [location, setLocation] = useState(user?.location ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null)
  const [coverUrl, setCoverUrl] = useState(user?.coverUrl ?? null)

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open && user) {
      setDisplayName(user.displayName)
      setUsername(user.username)
      setBio(user.bio ?? '')
      setWebsite(user.website ?? '')
      setLocation(user.location ?? '')
      setAvatarUrl(user.avatarUrl ?? null)
      setCoverUrl(user.coverUrl ?? null)
      setUsernameStatus('idle')
    }
  }, [open, user])

  // Live username availability check (excluding self)
  useEffect(() => {
    if (!open) return
    const trimmed = username.trim()
    if (trimmed === user?.username) {
      setUsernameStatus('idle')
      return
    }
    if (trimmed.length < 3 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameStatus('invalid')
      return
    }
    setUsernameStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profiles/${encodeURIComponent(trimmed)}`)
        if (res.ok) {
          setUsernameStatus('taken')
        } else if (res.status === 404) {
          setUsernameStatus('available')
        } else {
          setUsernameStatus('idle')
        }
      } catch {
        setUsernameStatus('idle')
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [username, open, user])

  const uploadFile = async (file: File, bucket: typeof BUCKET_AVATARS | typeof BUCKET_COVERS) => {
    const maxSize = bucket === BUCKET_AVATARS ? 5 : 10
    const err = validateImageFile(file, maxSize)
    if (err) {
      toast.error(err)
      return null
    }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('bucket', bucket)
    try {
      const data = await apiPost<{ url: string }>(`/api/upload`, fd)
      return data.url
    } catch (e: any) {
      toast.error(e.message || 'Gagal upload gambar')
      return null
    }
  }

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    const url = await uploadFile(file, BUCKET_AVATARS)
    if (url) {
      setAvatarUrl(url)
      toast.success('Foto profil diperbarui')
    }
    setAvatarUploading(false)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverUploading(true)
    const url = await uploadFile(file, BUCKET_COVERS)
    if (url) {
      setCoverUrl(url)
      toast.success('Sampul diperbarui')
    }
    setCoverUploading(false)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const canSave = () => {
    if (saving) return false
    if (!displayName.trim()) return false
    if (usernameStatus === 'checking' || usernameStatus === 'taken' || usernameStatus === 'invalid') return false
    if (bio.length > 160) return false
    if (website && !/^https?:\/\/.+/i.test(website)) return false
    return true
  }

  const handleSave = async () => {
    if (!canSave()) return
    setSaving(true)
    try {
      const updated = await apiPatch<ProfileDTO>('/api/profiles/me', {
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        website: website.trim(),
        location: location.trim(),
        avatarUrl,
        coverUrl,
      })
      // Update auth store with new info (preserve fields not returned by profile serializer)
      if (user) {
        setUser({
          ...user,
          displayName: updated.displayName,
          username: updated.username,
          bio: updated.bio,
          website: updated.website,
          location: updated.location,
          avatarUrl: updated.avatarUrl,
          coverUrl: updated.coverUrl,
        })
      }
      toast.success('Profil berhasil diperbarui')
      onSaved?.(updated)
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan profil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              <X className="h-4 w-4" />
            </Button>
            <DialogTitle className="text-lg">Edit profil</DialogTitle>
          </div>
          <Button
            onClick={handleSave}
            disabled={!canSave()}
            className="rounded-full font-semibold px-5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
          </Button>
        </DialogHeader>
        <DialogDescription className="sr-only">
          Perbarui foto profil, sampul, dan informasi pribadi kamu.
        </DialogDescription>

        <div className="overflow-y-auto scrollbar-thin">
          {/* Cover + Avatar */}
          <div className="relative">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="block w-full h-36 sm:h-44 bg-gradient-to-br from-primary/40 via-accent/30 to-primary/30 relative group overflow-hidden"
              style={
                coverUrl
                  ? {
                      backgroundImage: `url(${coverUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : undefined
              }
            >
              {!coverUrl && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/40" />
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                {coverUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Camera className="h-4 w-4" /> Ganti sampul
                  </span>
                )}
              </div>
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={onCoverChange}
              className="hidden"
            />

            {/* Avatar */}
            <div className="absolute -bottom-10 left-4">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full ring-4 ring-background bg-muted overflow-hidden group"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-primary">
                    {(displayName || username || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  {avatarUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                </div>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={onAvatarChange}
                className="hidden"
              />
            </div>
          </div>

          <div className="h-12" />

          {/* Form */}
          <div className="px-4 pb-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nama</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder="Nama tampilan"
              />
              <p className="text-xs text-muted-foreground text-right">{displayName.length}/50</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-7"
                  maxLength={20}
                  placeholder="username"
                />
                {usernameStatus !== 'idle' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {usernameStatus === 'available' && <Check className="h-4 w-4 text-emerald-500" />}
                    {usernameStatus === 'taken' && <X className="h-4 w-4 text-destructive" />}
                    {usernameStatus === 'invalid' && <X className="h-4 w-4 text-destructive" />}
                  </div>
                )}
              </div>
              {usernameStatus === 'taken' && (
                <p className="text-xs text-destructive">Username sudah digunakan</p>
              )}
              {usernameStatus === 'invalid' && (
                <p className="text-xs text-destructive">Min 3 karakter, hanya huruf/angka/underscore</p>
              )}
              {usernameStatus === 'available' && (
                <p className="text-xs text-emerald-500">Username tersedia</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={3}
                placeholder="Ceritakan tentang dirimu"
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{bio.length}/160</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Lokasi</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={60}
                placeholder="Jakarta, ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://situsmu.com"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
