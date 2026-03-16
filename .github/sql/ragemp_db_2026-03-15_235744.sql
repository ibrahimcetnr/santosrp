--
-- PostgreSQL database dump
--

\restrict hmhc7PVOcsHRgTEHdjDHzPmFejJcCKLnJRil29rinEyjh2ewGzwV6qVUSmVEFRy

-- Dumped from database version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.22 (Ubuntu 14.22-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: transfer_item(smallint, integer, smallint, smallint, integer, smallint, integer); Type: FUNCTION; Schema: public; Owner: ragemp_user
--

CREATE FUNCTION public.transfer_item(p_from_type smallint, p_from_id integer, p_from_slot smallint, p_to_type smallint, p_to_id integer, p_to_slot smallint, p_amount integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_item_id VARCHAR(64);
    v_metadata JSONB;
BEGIN
    -- Kaynak slotu kilitle (Aynı anda başkası dokunamaz)
    SELECT item_id, metadata INTO v_item_id, v_metadata 
    FROM inventory_items 
    WHERE parent_type = p_from_type AND parent_id = p_from_id AND slot = p_from_slot
    FOR UPDATE;

    IF NOT FOUND THEN RETURN FALSE; END IF;

    -- Kaynaktan miktarı düş
    UPDATE inventory_items SET amount = amount - p_amount 
    WHERE parent_type = p_from_type AND parent_id = p_from_id AND slot = p_from_slot;
    
    -- Miktar bittse satırı temizle
    DELETE FROM inventory_items WHERE amount <= 0;

    -- Hedef slota ekle (Slot doluysa üzerine ekle - UPSERT)
    INSERT INTO inventory_items (parent_type, parent_id, slot, item_id, amount, metadata)
    VALUES (p_to_type, p_to_id, p_to_slot, v_item_id, p_amount, v_metadata)
    ON CONFLICT (parent_type, parent_id, slot) 
    DO UPDATE SET amount = inventory_items.amount + EXCLUDED.amount;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION public.transfer_item(p_from_type smallint, p_from_id integer, p_from_slot smallint, p_to_type smallint, p_to_id integer, p_to_slot smallint, p_amount integer) OWNER TO ragemp_user;

--
-- Name: update_vehicle_modtime(); Type: FUNCTION; Schema: public; Owner: ragemp_user
--

CREATE FUNCTION public.update_vehicle_modtime() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_vehicle_modtime() OWNER TO ragemp_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: ragemp_user
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    social_id text,
    admin_level integer DEFAULT 0 NOT NULL,
    banned boolean DEFAULT false NOT NULL,
    ban_reason text,
    last_login timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    level integer DEFAULT 0,
    payday integer DEFAULT 0,
    xp integer DEFAULT 0,
    play_time integer DEFAULT 0
);


ALTER TABLE public.accounts OWNER TO ragemp_user;

--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: ragemp_user
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.accounts_id_seq OWNER TO ragemp_user;

--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ragemp_user
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: characters; Type: TABLE; Schema: public; Owner: ragemp_user
--

CREATE TABLE public.characters (
    id integer NOT NULL,
    account_id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    age integer DEFAULT 25 NOT NULL,
    gender integer DEFAULT 0 NOT NULL,
    money integer DEFAULT 500 NOT NULL,
    bank integer DEFAULT 2500 NOT NULL,
    job text,
    "position" jsonb,
    char_data jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created smallint DEFAULT 0,
    faction_id integer,
    faction_rank integer DEFAULT 0,
    faction_division integer,
    clothes jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.characters OWNER TO ragemp_user;

--
-- Name: characters_id_seq; Type: SEQUENCE; Schema: public; Owner: ragemp_user
--

CREATE SEQUENCE public.characters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.characters_id_seq OWNER TO ragemp_user;

--
-- Name: characters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ragemp_user
--

ALTER SEQUENCE public.characters_id_seq OWNED BY public.characters.id;


--
-- Name: factions; Type: TABLE; Schema: public; Owner: ragemp_user
--

CREATE TABLE public.factions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type integer NOT NULL,
    approvals jsonb DEFAULT '{}'::jsonb,
    stock_value integer DEFAULT 0,
    founder_id integer,
    tasks jsonb DEFAULT '[]'::jsonb,
    ranks jsonb DEFAULT '[]'::jsonb,
    divisions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    brokerfee integer DEFAULT 0,
    balance bigint DEFAULT 0,
    description text DEFAULT 'Bu birliğin henüz bir açıklaması bulunmuyor.'::text,
    chat_enabled boolean DEFAULT true NOT NULL
);


ALTER TABLE public.factions OWNER TO ragemp_user;

--
-- Name: factions_id_seq; Type: SEQUENCE; Schema: public; Owner: ragemp_user
--

CREATE SEQUENCE public.factions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.factions_id_seq OWNER TO ragemp_user;

--
-- Name: factions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ragemp_user
--

ALTER SEQUENCE public.factions_id_seq OWNED BY public.factions.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: ragemp_user
--

CREATE TABLE public.inventory_items (
    id bigint NOT NULL,
    parent_type smallint NOT NULL,
    parent_id integer NOT NULL,
    slot smallint NOT NULL,
    item_id character varying(64) NOT NULL,
    amount integer DEFAULT 1 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.inventory_items OWNER TO ragemp_user;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: ragemp_user
--

CREATE SEQUENCE public.inventory_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.inventory_items_id_seq OWNER TO ragemp_user;

--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ragemp_user
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: ragemp_user
--

CREATE TABLE public.vehicles (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    model character varying(50) NOT NULL,
    plate character varying(8) NOT NULL,
    is_parked boolean DEFAULT true,
    "position" jsonb DEFAULT '{"h": 0, "x": 0, "y": 0, "z": 0, "dimension": 0}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    faction_id integer
);


ALTER TABLE public.vehicles OWNER TO ragemp_user;

--
-- Name: vehicles_data; Type: TABLE; Schema: public; Owner: ragemp_user
--

CREATE TABLE public.vehicles_data (
    id integer NOT NULL,
    model character varying(50) NOT NULL,
    fuel_type character varying(20) DEFAULT 'benzin'::character varying NOT NULL,
    fuel_tank_size integer DEFAULT 65 NOT NULL,
    trunk_size integer DEFAULT 30 NOT NULL,
    dealership_stock integer DEFAULT 0 NOT NULL,
    price integer DEFAULT 0 NOT NULL,
    CONSTRAINT vehicles_data_fuel_type_check CHECK (((fuel_type)::text = ANY ((ARRAY['benzin'::character varying, 'elektrik'::character varying, 'dizel'::character varying, 'lpg'::character varying])::text[])))
);


ALTER TABLE public.vehicles_data OWNER TO ragemp_user;

--
-- Name: vehicles_data_id_seq; Type: SEQUENCE; Schema: public; Owner: ragemp_user
--

CREATE SEQUENCE public.vehicles_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.vehicles_data_id_seq OWNER TO ragemp_user;

--
-- Name: vehicles_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ragemp_user
--

ALTER SEQUENCE public.vehicles_data_id_seq OWNED BY public.vehicles_data.id;


--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: ragemp_user
--

CREATE SEQUENCE public.vehicles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.vehicles_id_seq OWNER TO ragemp_user;

--
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ragemp_user
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: characters id; Type: DEFAULT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.characters ALTER COLUMN id SET DEFAULT nextval('public.characters_id_seq'::regclass);


--
-- Name: factions id; Type: DEFAULT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.factions ALTER COLUMN id SET DEFAULT nextval('public.factions_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- Name: vehicles_data id; Type: DEFAULT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.vehicles_data ALTER COLUMN id SET DEFAULT nextval('public.vehicles_data_id_seq'::regclass);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: characters characters_pkey; Type: CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_pkey PRIMARY KEY (id);


--
-- Name: factions factions_pkey; Type: CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.factions
    ADD CONSTRAINT factions_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_items unique_slot_per_container; Type: CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT unique_slot_per_container UNIQUE (parent_type, parent_id, slot);


--
-- Name: vehicles_data vehicles_data_model_key; Type: CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.vehicles_data
    ADD CONSTRAINT vehicles_data_model_key UNIQUE (model);


--
-- Name: vehicles_data vehicles_data_pkey; Type: CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.vehicles_data
    ADD CONSTRAINT vehicles_data_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_plate_key; Type: CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_plate_key UNIQUE (plate);


--
-- Name: accounts_social_id_idx; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX accounts_social_id_idx ON public.accounts USING btree (social_id);


--
-- Name: accounts_username_key; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE UNIQUE INDEX accounts_username_key ON public.accounts USING btree (username);


--
-- Name: characters_account_id_idx; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX characters_account_id_idx ON public.characters USING btree (account_id);


--
-- Name: factions_name_key; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE UNIQUE INDEX factions_name_key ON public.factions USING btree (name);


--
-- Name: idx_factions_founder; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX idx_factions_founder ON public.factions USING btree (founder_id);


--
-- Name: idx_factions_type; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX idx_factions_type ON public.factions USING btree (type);


--
-- Name: idx_inventory_metadata; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX idx_inventory_metadata ON public.inventory_items USING gin (metadata);


--
-- Name: idx_inventory_parent; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX idx_inventory_parent ON public.inventory_items USING btree (parent_type, parent_id);


--
-- Name: idx_vehicles_data_model; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX idx_vehicles_data_model ON public.vehicles_data USING btree (model);


--
-- Name: idx_vehicles_faction; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX idx_vehicles_faction ON public.vehicles USING btree (faction_id);


--
-- Name: idx_vehicles_owner; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX idx_vehicles_owner ON public.vehicles USING btree (owner_id);


--
-- Name: idx_vehicles_parked; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX idx_vehicles_parked ON public.vehicles USING btree (is_parked);


--
-- Name: idx_vehicles_plate; Type: INDEX; Schema: public; Owner: ragemp_user
--

CREATE INDEX idx_vehicles_plate ON public.vehicles USING btree (plate);


--
-- Name: vehicles trg_vehicles_updated; Type: TRIGGER; Schema: public; Owner: ragemp_user
--

CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_vehicle_modtime();


--
-- Name: characters characters_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: factions fk_founder; Type: FK CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.factions
    ADD CONSTRAINT fk_founder FOREIGN KEY (founder_id) REFERENCES public.characters(id) ON DELETE SET NULL;


--
-- Name: vehicles fk_vehicle_faction; Type: FK CONSTRAINT; Schema: public; Owner: ragemp_user
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT fk_vehicle_faction FOREIGN KEY (faction_id) REFERENCES public.factions(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict hmhc7PVOcsHRgTEHdjDHzPmFejJcCKLnJRil29rinEyjh2ewGzwV6qVUSmVEFRy

