import { use } from 'react'
import { AuthContext } from './authContext'

export const useAuth = () => use(AuthContext)
