import 'dotenv/config';
import readline from 'readline';
import bcrypt from 'bcryptjs';

function printHelp() {
  console.log(`
Revati Global - Admin User Creation CLI

Usage:
  node scripts/create-admin.js [options]

Options:
  --name <name>          Admin full name (or via ADMIN_NAME env)
  --email <email>        Admin email address (or via ADMIN_EMAIL env)
  --password <password>  Admin password (or via ADMIN_PASSWORD env, min 8 chars)
  --help, -h             Show this help message

If flags or env vars are omitted, the script will prompt interactively for input.
Masks password on interactive input.
`);
}

function ask(question, isPassword = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (isPassword) {
      process.stdout.write(question);
      let pass = '';
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on('data', function handler(char) {
        char = char + '';
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            process.stdin.setRawMode?.(false);
            process.stdin.pause();
            process.stdin.removeListener('data', handler);
            process.stdout.write('\n');
            rl.close();
            resolve(pass);
            break;
          case '\u0003':
            process.exit(1);
            break;
          default:
            pass += char;
            process.stdout.write('*');
            break;
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      parsed.help = true;
    } else if (args[i].startsWith('--')) {
      const key = args[i].replace(/^--/, '');
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      parsed[key] = value;
    }
  }
  return parsed;
}

async function createAdmin() {
  const cliArgs = parseCliArgs();

  if (cliArgs.help) {
    printHelp();
    process.exit(0);
  }

  console.log('--- Revati Global: Create Admin User ---');

  const name = cliArgs.name || process.env.ADMIN_NAME || (await ask('Admin Full Name: '));
  const email = cliArgs.email || process.env.ADMIN_EMAIL || (await ask('Admin Email: '));
  const password = cliArgs.password || process.env.ADMIN_PASSWORD || (await ask('Admin Password: ', true));

  if (!name || !email || !password) {
    console.error('Error: Name, email, and password are required.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  const { query, pool } = await import('../src/config/db.js');

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userRes = await query(
      `INSERT INTO public."users" ("name", "email", "password", "created_at", "updated_at")
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT ("email") DO UPDATE
         SET "name" = EXCLUDED."name",
             "password" = EXCLUDED."password",
             "updated_at" = NOW()
       RETURNING id, name, email;`,
      [name, email.toLowerCase(), hashedPassword]
    );

    const user = userRes.rows[0];
    console.log(`User created/updated successfully: [ID: ${user.id}] ${user.name} (${user.email})`);

    // Assign 'super admin' role
    const roleRes = await query(`SELECT id FROM public."roles" WHERE name = 'super admin' LIMIT 1;`);
    if (roleRes.rows.length > 0) {
      const roleId = roleRes.rows[0].id;
      await query(
        `INSERT INTO public."model_has_roles" ("role_id", "model_type", "model_id")
         VALUES ($1, 'App\\\\Models\\\\User', $2)
         ON CONFLICT DO NOTHING;`,
        [roleId, user.id]
      );
      console.log(`Assigned role 'super admin' to user ${user.email}`);
    } else {
      console.warn(`Warning: 'super admin' role not found in database. Run migration.sql first.`);
    }

    console.log('Admin account setup complete.');
  } catch (err) {
    console.error('Failed to create admin user:', err.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

createAdmin();
