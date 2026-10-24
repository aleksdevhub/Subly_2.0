-- =============================================================
--  Subly — схема базы данных (SQLite)
--  База хранится в одном файле subly.db в папке проекта.
--  Скрипт выполняется автоматически при запуске приложения,
--  таблицы создаются только если их ещё нет.
-- =============================================================

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    email           TEXT    NOT NULL UNIQUE,
    password_hash   TEXT    NOT NULL,
    monthly_budget  REAL    NOT NULL DEFAULT 5000,
    role            TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),  -- роль: пользователь или администратор
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Категории подписок (у каждого пользователя свои)
CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users (id),
    name        TEXT    NOT NULL,
    icon        TEXT    NOT NULL DEFAULT 'grid',
    color       TEXT    NOT NULL DEFAULT '#5B4CF0',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, name)
);

-- Подписки
CREATE TABLE IF NOT EXISTS subscriptions (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL REFERENCES users (id),
    category_id        INTEGER NOT NULL REFERENCES categories (id),
    name               TEXT    NOT NULL,
    price              REAL    NOT NULL CHECK (price > 0),
    billing_period     TEXT    NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly')),
    start_date         TEXT    NOT NULL,   -- дата в формате ГГГГ-ММ-ДД
    next_payment_date  TEXT    NOT NULL,   -- дата в формате ГГГГ-ММ-ДД
    payment_method     TEXT    NULL,
    is_active          INTEGER NOT NULL DEFAULT 1,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_subscriptions_user_next ON subscriptions (user_id, next_payment_date);

-- История платежей.
-- Название подписки копируется в платёж, чтобы история сохранялась даже после удаления подписки.
CREATE TABLE IF NOT EXISTS payments (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL REFERENCES users (id),
    subscription_id    INTEGER NULL REFERENCES subscriptions (id),
    category_id        INTEGER NULL REFERENCES categories (id),
    subscription_name  TEXT    NOT NULL,
    amount             REAL    NOT NULL,
    paid_at            TEXT    NOT NULL,   -- дата в формате ГГГГ-ММ-ДД
    payment_method     TEXT    NULL,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_payments_user_date ON payments (user_id, paid_at);

-- Один платёж по подписке на одну дату (защита от дублей)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_sub_date ON payments (subscription_id, paid_at)
    WHERE subscription_id IS NOT NULL;
