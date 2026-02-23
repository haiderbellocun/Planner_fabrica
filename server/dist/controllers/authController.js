import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
const secret = env.JWT_SECRET;
const signOptions = {
    expiresIn: (env.JWT_EXPIRES_IN ?? '7d'),
};
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        // Get user from database
        const result = await query('SELECT id, email, password_hash, full_name, avatar_url, is_active FROM public.users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = result.rows[0];
        if (!user.is_active) {
            return res.status(401).json({ error: 'Account is disabled' });
        }
        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Get user profile and role (user_roles.user_id references profiles.id)
        const profileResult = await query(`SELECT p.id AS profile_id, ur.role
       FROM public.profiles p
       LEFT JOIN public.user_roles ur ON ur.user_id = p.id
       WHERE p.user_id = $1
       LIMIT 1`, [user.id]);
        const profileId = profileResult.rows[0]?.profile_id;
        const role = profileResult.rows[0]?.role || 'user';
        if (!profileId) {
            return res.status(500).json({ error: 'Profile not found' });
        }
        // Update last sign in
        await query('UPDATE public.users SET last_sign_in_at = NOW() WHERE id = $1', [user.id]);
        // JWT: profileId = profiles.id (same as user_roles.user_id for this user)
        const token = jwt.sign({
            id: user.id,
            profileId,
            email: user.email,
            role,
        }, secret, signOptions);
        res.json({
            user: {
                id: user.id,
                profileId: profileId,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                role: role,
            },
            token,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const register = async (req, res) => {
    try {
        const { email, password, full_name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        // Check if user already exists
        const existingUser = await query('SELECT id FROM public.users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        // Hash password
        const password_hash = await bcrypt.hash(password, 10);
        // Insert user
        const result = await query(`INSERT INTO public.users (email, password_hash, full_name, email_verified, is_active)
       VALUES ($1, $2, $3, true, true)
       RETURNING id, email, full_name, avatar_url`, [email, password_hash, full_name || email.split('@')[0]]);
        const user = result.rows[0];
        // Get profile ID (created automatically by trigger)
        const profileResult = await query('SELECT id FROM public.profiles WHERE user_id = $1', [user.id]);
        const profileId = profileResult.rows[0]?.id;
        if (!profileId) {
            return res.status(500).json({ error: 'Profile creation failed' });
        }
        // Generate JWT token with profileId (user role will be 'user' by default)
        const token = jwt.sign({
            id: user.id,
            profileId: profileId,
            email: user.email,
            role: 'user',
        }, secret, signOptions);
        res.status(201).json({
            user: {
                id: user.id,
                profileId: profileId,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                role: 'user',
            },
            token,
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const getCurrentUser = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get full user profile (user_roles.user_id = profiles.id)
        const result = await query(`SELECT
        u.id, u.email, u.full_name, u.avatar_url,
        p.id AS profile_id,
        COALESCE(ur.role::TEXT, 'user') AS role
       FROM public.users u
       LEFT JOIN public.profiles p ON p.user_id = u.id
       LEFT JOIN public.user_roles ur ON ur.user_id = p.id
       WHERE u.id = $1`, [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = result.rows[0];
        res.json({
            user: {
                id: user.id,
                profileId: user.profile_id,
                email: user.email,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const logout = async (req, res) => {
    // With JWT, logout is handled client-side by removing the token
    res.json({ message: 'Logged out successfully' });
};
