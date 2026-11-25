import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

export async function listUsers(req, res, next) {
    try {
        const sql = `
            SELECT 
                u.id, 
                u.name, 
                u.email, 
                u.phone_number,
                u.image,
                u.created_at, 
                u.updated_at,
                COALESCE(r.name, 'none') AS role,
                r.id AS role_id
            FROM public."users" u
            LEFT JOIN public."model_has_roles" mhr ON mhr.model_id = u.id AND mhr.model_type = 'App\\Models\\User'
            LEFT JOIN public."roles" r ON r.id = mhr.role_id
            ORDER BY u.created_at DESC;
        `;

        const { rows: users } = await query(sql);

        const rolesRes = await query(`SELECT id, name FROM public."roles" ORDER BY id ASC;`);

        return res.json({
            result: 'success',
            users,
            availableRoles: rolesRes.rows
        });
    } catch (err) {
        next(err);
    }
}

export async function createUser(req, res, next) {
    try {
        const { name, email, password, role = 'editor', phone_number } = req.body || {};

        if (!name || !email || !password) {
            return res.status(400).json({
                result: 'error',
                message: 'Name, email, and password are required.'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                result: 'error',
                message: 'Password must be at least 8 characters long.'
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Check if email already exists
        const existing = await query(`SELECT id FROM public."users" WHERE LOWER(email) = $1 LIMIT 1`, [cleanEmail]);
        if (existing.rows.length > 0) {
            return res.status(409).json({
                result: 'error',
                message: 'A user with this email address already exists.'
            });
        }

        // Validate role
        const roleRes = await query(`SELECT id, name FROM public."roles" WHERE LOWER(name) = $1 LIMIT 1`, [role.trim().toLowerCase()]);
        if (roleRes.rows.length === 0) {
            return res.status(400).json({
                result: 'error',
                message: `Invalid role '${role}'. Valid roles: super admin, admin, editor, sales`
            });
        }
        const roleId = roleRes.rows[0].id;

        const hashedPassword = await bcrypt.hash(password, 10);

        const userRes = await query(
            `INSERT INTO public."users" ("name", "email", "password", "phone_number", "created_at", "updated_at")
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING id, name, email, phone_number, created_at;`,
            [name.trim(), cleanEmail, hashedPassword, phone_number ? phone_number.trim() : null]
        );

        const newUser = userRes.rows[0];

        // Assign role in model_has_roles
        await query(
            `INSERT INTO public."model_has_roles" ("role_id", "model_type", "model_id")
             VALUES ($1, 'App\\Models\\User', $2)
             ON CONFLICT ("role_id", "model_id", "model_type") DO NOTHING;`,
            [roleId, newUser.id]
        );

        return res.status(201).json({
            result: 'success',
            message: `User created successfully with role '${roleRes.rows[0].name}'`,
            user: {
                ...newUser,
                role: roleRes.rows[0].name
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function updateUserRole(req, res, next) {
    try {
        const { id } = req.params;
        const { role } = req.body || {};

        if (!role) {
            return res.status(400).json({ result: 'error', message: 'Role is required.' });
        }

        const roleRes = await query(`SELECT id, name FROM public."roles" WHERE LOWER(name) = $1 LIMIT 1`, [role.trim().toLowerCase()]);
        if (roleRes.rows.length === 0) {
            return res.status(400).json({
                result: 'error',
                message: `Invalid role '${role}'. Valid roles: super admin, admin, editor, sales`
            });
        }
        const newRoleId = roleRes.rows[0].id;

        // Prevent demoting the current user if they are the last super admin
        if (String(req.user.id) === String(id) && role.trim().toLowerCase() !== 'super admin') {
            const superCount = await query(`
                SELECT COUNT(*)::int AS cnt 
                FROM public."model_has_roles" mhr
                JOIN public."roles" r ON r.id = mhr.role_id
                WHERE r.name = 'super admin';
            `);
            if (superCount.rows[0]?.cnt <= 1) {
                return res.status(400).json({
                    result: 'error',
                    message: 'Cannot demote the only remaining Super Admin account.'
                });
            }
        }

        // Remove old role assignment
        await query(
            `DELETE FROM public."model_has_roles" WHERE "model_id" = $1 AND "model_type" = 'App\\Models\\User'`,
            [id]
        );

        // Assign new role
        await query(
            `INSERT INTO public."model_has_roles" ("role_id", "model_type", "model_id")
             VALUES ($1, 'App\\Models\\User', $2)`,
            [newRoleId, id]
        );

        return res.json({
            result: 'success',
            message: `Role updated to '${roleRes.rows[0].name}' successfully.`
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteUser(req, res, next) {
    try {
        const { id } = req.params;

        if (String(req.user.id) === String(id)) {
            return res.status(400).json({
                result: 'error',
                message: 'Cannot delete your own administrative account while logged in.'
            });
        }

        // Delete role mapping
        await query(`DELETE FROM public."model_has_roles" WHERE "model_id" = $1`, [id]);

        const { rowCount } = await query(`DELETE FROM public."users" WHERE id = $1`, [id]);

        if (rowCount === 0) {
            return res.status(404).json({ result: 'error', message: 'User not found' });
        }

        return res.json({
            result: 'success',
            message: 'User removed successfully.'
        });
    } catch (err) {
        next(err);
    }
}
