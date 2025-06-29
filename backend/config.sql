
-- Create tables
CREATE TABLE user_privileges (
    id_privilege SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE users (
    id_user SERIAL PRIMARY KEY,
    id_privilege INTEGER NOT NULL REFERENCES user_privileges(id_privilege),
    name VARCHAR(100) NOT NULL,password VARCHAR(255),
	token VARCHAR(255),
	token_expiry TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    email VARCHAR(255) NOT NULL UNIQUE,
    login VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE actions (
    id_action SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE locks (
    id_lock SERIAL PRIMARY KEY,
    id_privilege INTEGER NOT NULL REFERENCES user_privileges(id_privilege),
    is_open BOOLEAN NOT NULL DEFAULT false,
    last_modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE log_entries (
    id_log SERIAL PRIMARY KEY,
    id_user INTEGER NOT NULL REFERENCES users(id_user),
    id_action INTEGER NOT NULL REFERENCES actions(id_action),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_lock INTEGER REFERENCES locks(id_lock)
);

CREATE TABLE system_log (
    id_system_log SERIAL PRIMARY KEY,
    id_action INTEGER NOT NULL REFERENCES actions(id_action),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    affected_ip INET NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX idx_log_entries_user ON log_entries(id_user);
CREATE INDEX idx_log_entries_action ON log_entries(id_action);
CREATE INDEX idx_system_log_action ON system_log(id_action);
-----------
-- User-defined functions
-----------1
CREATE OR REPLACE FUNCTION get_user_privilege(user_id INTEGER)
RETURNS TABLE(privilege_id INT, privilege_name VARCHAR) AS $$
BEGIN
    RETURN QUERY 
    SELECT p.id_privilege, p.name
    FROM users u
    JOIN user_privileges p ON u.id_privilege = p.id_privilege
    WHERE u.id_user = user_id;
END;
$$ LANGUAGE plpgsql;
----2
CREATE OR REPLACE FUNCTION count_actions_by_user(
    user_id INTEGER, 
    start_time TIMESTAMP DEFAULT NOW() - INTERVAL '30 days', 
    end_time TIMESTAMP DEFAULT NOW()
) RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) 
        FROM log_entries 
        WHERE id_user = user_id 
        AND timestamp BETWEEN start_time AND end_time
    );
END;
$$ LANGUAGE plpgsql;
----3
CREATE OR REPLACE FUNCTION check_lock_status(lock_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT is_open FROM locks WHERE id_lock = lock_id);
END;
$$ LANGUAGE plpgsql;
----4
CREATE OR REPLACE FUNCTION get_failed_attempts(
    user_id INTEGER, 
    minutes_back INTEGER DEFAULT 15
) RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM log_entries l
        JOIN actions a ON l.id_action = a.id_action
        WHERE l.id_user = user_id
        AND l.timestamp > NOW() - (minutes_back * INTERVAL '1 minute')
        AND a.name LIKE '%Failed%'
    );
END;
$$ LANGUAGE plpgsql;

---------------------------------
--
-- Get user privilege
--SELECT * FROM get_user_privilege(1);
--
-- Count user actions
--SELECT count_actions_by_user(1);
--
-- Check lock status
--SELECT check_lock_status(1);
--
-- Get failed attempts
--SELECT get_failed_attempts(1);
--
---------------------------------
-----------
-- Triggers
-- 1. Prevent privilege deletion if in use
-----------

CREATE OR REPLACE FUNCTION prevent_privilege_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE id_privilege = OLD.id_privilege) THEN
        RAISE EXCEPTION 'Cannot delete privilege that is assigned to users';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER privilege_deletion_guard
BEFORE DELETE ON user_privileges
FOR EACH ROW EXECUTE FUNCTION prevent_privilege_deletion();

-- 2. Auto-log privilege changes
CREATE OR REPLACE FUNCTION log_privilege_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id_privilege <> NEW.id_privilege THEN
        INSERT INTO system_log (id_action, affected_ip)
        VALUES (
            (SELECT id_action FROM actions WHERE name = 'Privilege Change'), 
            '0.0.0.0'  -- Placeholder IP
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_privilege_change_audit
AFTER UPDATE OF id_privilege ON users
FOR EACH ROW EXECUTE FUNCTION log_privilege_changes();

-- 3. Prevent action deletion if logged
CREATE OR REPLACE FUNCTION prevent_action_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM log_entries 
        WHERE id_action = OLD.id_action
        UNION
        SELECT 1 
        FROM system_log 
        WHERE id_action = OLD.id_action
    ) THEN
        RAISE EXCEPTION 'Cannot delete action with existing log entries';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER action_deletion_guard
BEFORE DELETE ON actions
FOR EACH ROW EXECUTE FUNCTION prevent_action_deletion();

-- 4. Auto-close locks after 5 failed attempts
CREATE OR REPLACE FUNCTION auto_lock_account()
RETURNS TRIGGER AS $$
BEGIN
    IF get_failed_attempts(NEW.id_user) >= 5 THEN
        UPDATE locks 
        SET is_open = false 
        WHERE id_lock IN (
            SELECT l.id_lock 
            FROM locks l
            JOIN user_privileges p ON l.id_privilege = p.id_privilege
            JOIN users u ON u.id_privilege = p.id_privilege
            WHERE u.id_user = NEW.id_user
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a helper function first
CREATE OR REPLACE FUNCTION is_failed_action(action_id INT) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM actions 
        WHERE id_action = action_id 
        AND name LIKE '%Failed%'
    );
END;
$$ LANGUAGE plpgsql;

-- Then modify the trigger
CREATE OR REPLACE FUNCTION auto_lock_account()
RETURNS TRIGGER AS $$
BEGIN
    -- Your locking logic here
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger without subquery
CREATE TRIGGER failed_attempt_lock
AFTER INSERT ON log_entries
FOR EACH ROW
WHEN (is_failed_action(NEW.id_action))  -- Use the helper function
EXECUTE FUNCTION auto_lock_account();

-- 5. Audit user deletions
CREATE OR REPLACE FUNCTION audit_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO system_log (id_action, affected_ip)
    VALUES (
        (SELECT id_action FROM actions WHERE name = 'User Deletion'), 
        '0.0.0.0'  -- Placeholder IP
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_deletion_audit
AFTER DELETE ON users
FOR EACH ROW EXECUTE FUNCTION audit_user_deletion();

---- token hsit


-- Create tokens table for refresh tokens
CREATE TABLE tokens (
    token_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id_user),
    token VARCHAR(512) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION validate_token(token_to_check VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE token = token_to_check 
    AND token_expiry > CURRENT_TIMESTAMP
  );
END;
$$ LANGUAGE plpgsql;

-- Add these to your existing schema

-- Create refresh token function
CREATE OR REPLACE FUNCTION refresh_user_token(user_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
  new_token VARCHAR;
BEGIN
  SELECT jwt_sign(
    json_build_object(
      'id_user', id_user,
      'login', login,
      'email', email,
      'id_privilege', id_privilege,
      'exp', EXTRACT(EPOCH FROM NOW() + INTERVAL '1 hour')
    ),
    'energy_security_token'
  ) INTO new_token
  FROM users WHERE id_user = user_id;

  UPDATE users 
  SET token = new_token, 
      token_expiry = NOW() + INTERVAL '1 hour'
  WHERE id_user = user_id;

  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Create token validation function
CREATE OR REPLACE FUNCTION validate_user_token(token_to_check VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE token = token_to_check 
      AND token_expiry > NOW()
  );
END;
$$ LANGUAGE plpgsql;

INSERT INTO actions (id_action, name, description) VALUES
(1, 'Lock Created', 'A new lock was created by user'),
(2, 'Lock State Changed', 'Lock was opened or closed'),
(3, 'Lock Deleted', 'Lock was deleted from system'),
(4, 'User Logged In', 'User successfully authenticated'),
(5, 'User Registered', 'New user account created'),
(6, 'Privilege Changed', 'User privilege level modified'),
(7, 'Account Locked', 'User account was locked'),
(8, 'Account Unlocked', 'User account was unlocked');

-- 1. Log lock creation
CREATE OR REPLACE FUNCTION log_lock_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO log_entries (id_user, id_action, id_lock)
    VALUES (current_user_id(), 1, NEW.id_lock);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Log lock state changes (open/close)
CREATE OR REPLACE FUNCTION log_lock_state_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_open IS DISTINCT FROM NEW.is_open THEN
        INSERT INTO log_entries (id_user, id_action, id_lock)
        VALUES (current_user_id(), 2, NEW.id_lock);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Log lock deletion
CREATE OR REPLACE FUNCTION log_lock_deletion()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO log_entries (id_user, id_action, id_lock)
    VALUES (current_user_id(), 3, OLD.id_lock);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 4. Log user privilege changes
CREATE OR REPLACE FUNCTION log_privilege_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.id_privilege <> NEW.id_privilege THEN
        INSERT INTO log_entries (id_user, id_action)
        VALUES (current_user_id(), 6);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Log account locking/unlocking
CREATE OR REPLACE FUNCTION log_account_lock_change()
RETURNS TRIGGER AS $$
DECLARE
    action_id INT;
BEGIN
    IF NEW.is_locked AND NOT OLD.is_locked THEN
        action_id := 7; -- Account Locked
    ELSIF NOT NEW.is_locked AND OLD.is_locked THEN
        action_id := 8; -- Account Unlocked
    ELSE
        RETURN NEW;
    END IF;
    
    INSERT INTO log_entries (id_user, id_action)
    VALUES (current_user_id(), action_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Log user deletions
CREATE OR REPLACE FUNCTION log_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO log_entries (id_user, id_action)
    VALUES (current_user_id(), 3); -- Using 3 for deletion
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Add this function to get the current user from session context
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS INTEGER AS $$
DECLARE
    user_id INTEGER;
BEGIN
    -- Get user ID from session context
    SELECT current_setting('app.user_id', true)::INTEGER INTO user_id;
    RETURN user_id;
EXCEPTION
    WHEN undefined_object THEN RETURN NULL; -- Handle case when not set
END;
$$ LANGUAGE plpgsql;

-- For locks table
CREATE TRIGGER trigger_log_lock_creation
AFTER INSERT ON locks
FOR EACH ROW EXECUTE FUNCTION log_lock_creation();

CREATE TRIGGER trigger_log_lock_state_change
AFTER UPDATE ON locks
FOR EACH ROW EXECUTE FUNCTION log_lock_state_change();

CREATE TRIGGER trigger_log_lock_deletion
AFTER DELETE ON locks
FOR EACH ROW EXECUTE FUNCTION log_lock_deletion();

-- For users table
CREATE TRIGGER trigger_log_privilege_change
AFTER UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION log_privilege_change();

CREATE TRIGGER trigger_log_account_lock_change
AFTER UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION log_account_lock_change();

CREATE TRIGGER trigger_log_user_deletion
AFTER DELETE ON users
FOR EACH ROW EXECUTE FUNCTION log_user_deletion();

CREATE OR REPLACE FUNCTION log_action(
    action_id INTEGER,
    lock_id INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO log_entries (id_user, id_action, id_lock, timestamp)
    VALUES (current_user_id(), action_id, lock_id, NOW());
END;
$$ LANGUAGE plpgsql;
