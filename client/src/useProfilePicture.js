import { useEffect, useState } from 'react'
import config from './config'

const profiles = {
  customer: { url: config.REST_API.Customer.ProfilePicture, tokenKey: 'p4p_customer_token' },
  supervisor: { url: config.REST_API.Supervisor.ProfilePicture, tokenKey: 'p4p_supervisor_token' },
  basic: { url: config.REST_API.Basic.ProfilePicture, tokenKey: 'p4p_basic_token' },
}

export function useProfilePicture(role, legacyKey) {
  const [profileImage, setProfileImage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let requestId = 0
    let objectUrl = ''
    const { url, tokenKey } = profiles[role]
    setProfileImage('')
    setError('')

    const load = async () => {
      const token = localStorage.getItem(tokenKey)
      const currentRequest = ++requestId
      if (!token) return

      try {
        let response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })

        const savedImage = legacyKey && response.status === 404 && localStorage.getItem(legacyKey)
        if (savedImage) {
          const image = await fetch(savedImage).then((result) => result.blob())
          const upload = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': image.type },
            body: image,
          })
          if (upload.ok) {
            localStorage.removeItem(legacyKey)
            response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
            window.dispatchEvent(new CustomEvent('p4p:profile-picture-updated', { detail: { role } }))
          } else {
            setError('Unable to sync the existing profile picture. Please upload it again.')
          }
        }

        if (!active || currentRequest !== requestId) return
        if (response.status === 404) {
          if (objectUrl) URL.revokeObjectURL(objectUrl)
          objectUrl = ''
          setProfileImage('')
          return
        }
        if (!response.ok) throw new Error('Unable to load profile picture.')
        const nextUrl = URL.createObjectURL(await response.blob())
        if (!active || currentRequest !== requestId) {
          URL.revokeObjectURL(nextUrl)
          return
        }
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        objectUrl = nextUrl
        setProfileImage(nextUrl)
        setError('')
      } catch {
        if (active && currentRequest === requestId) setError('Unable to load profile picture.')
      }
    }

    const onUpdate = (event) => {
      if (event.detail.role === role) load()
    }
    window.addEventListener('p4p:profile-picture-updated', onUpdate)
    load()
    return () => {
      active = false
      requestId++
      window.removeEventListener('p4p:profile-picture-updated', onUpdate)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [role, legacyKey])

  const uploadProfilePicture = async (file) => {
    if (!file) return false
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, or WebP image under 5 MB.')
      return false
    }
    const { url, tokenKey } = profiles[role]
    const token = localStorage.getItem(tokenKey)
    if (!token) {
      setError('Please log in to save your profile picture.')
      return false
    }
    setUploading(true)
    setError('')
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
        body: file,
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.message || 'Unable to save profile picture.')
      }
      window.dispatchEvent(new CustomEvent('p4p:profile-picture-updated', { detail: { role } }))
      return true
    } catch (uploadError) {
      setError(uploadError.message)
      return false
    } finally {
      setUploading(false)
    }
  }

  return { profileImage, uploadProfilePicture, uploading, error }
}