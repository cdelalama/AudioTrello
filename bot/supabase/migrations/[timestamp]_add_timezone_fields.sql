alter table users
add column language_code varchar(10) default 'es',
add column timezone_offset integer default 60, -- UTC+1 (60 minutos) por defecto
add column timezone_last_updated timestamp with time zone default now();

-- Añadir comentarios para documentación
comment on column users.language_code is 'Código de idioma del usuario (ej: es, en)';
comment on column users.timezone_offset is 'Offset del timezone en minutos';
comment on column users.timezone_last_updated is 'Última vez que se actualizó el timezone';