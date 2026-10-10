-- KSUID: 4-byte big-endian timestamp (seconds since 2014-05-13T16:53:20Z)
-- + 16 random bytes, base62-encoded to a fixed 27 chars. Sorts by creation time.
create extension if not exists pgcrypto with schema extensions;
--> statement-breakpoint
create extension if not exists moddatetime with schema extensions;
--> statement-breakpoint
create or replace function public.gen_ksuid()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  ts bigint := floor(extract(epoch from clock_timestamp()))::bigint - 1400000000;
  bytes bytea := substring(int8send(ts) from 5 for 4) || extensions.gen_random_bytes(16);
  n numeric := 0;
  result text := '';
begin
  for i in 0..19 loop
    n := n * 256 + get_byte(bytes, i);
  end loop;
  for i in 1..27 loop
    result := substr(alphabet, mod(n, 62)::int + 1, 1) || result;
    n := div(n, 62);
  end loop;
  return result;
end;
$$;
