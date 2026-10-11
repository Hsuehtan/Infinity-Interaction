CREATE TABLE providers (
 id uuid PRIMARY KEY, current_version integer NOT NULL DEFAULT 1, enabled boolean NOT NULL DEFAULT false,
 archived_at timestamptz, created_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE provider_versions (
 provider_id uuid NOT NULL REFERENCES providers(id), version integer NOT NULL,
 config jsonb NOT NULL, credential_ref uuid REFERENCES model_credentials(id), created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider_id,version)
);
ALTER TABLE providers ADD CONSTRAINT provider_current_version FOREIGN KEY(id,current_version) REFERENCES provider_versions(provider_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE managed_model_versions (
 model_id uuid NOT NULL, version integer NOT NULL, provider_id uuid NOT NULL REFERENCES providers(id), definition jsonb NOT NULL,
 PRIMARY KEY(model_id,version), FOREIGN KEY(model_id,version) REFERENCES model_connection_versions(connection_id,version)
);
CREATE TABLE model_admin_commands (
 command_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES users(id), request_hash text NOT NULL,
 response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE generation_runtime (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), version integer NOT NULL DEFAULT 1,
 config jsonb NOT NULL DEFAULT '{"imageEnabled":false,"videoEnabled":false,"budgetCents":0,"maxConcurrent":1}', updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO generation_runtime(id) VALUES(true);
CREATE TABLE generation_worker_heartbeats (id text PRIMARY KEY, updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE generation_jobs ADD COLUMN provider_namespace text NOT NULL DEFAULT 'https://api.tu-zi.com';
DROP INDEX generation_provider_task_identity;
CREATE UNIQUE INDEX generation_provider_task_identity ON generation_jobs(provider_namespace,provider_task_id) WHERE provider_task_id IS NOT NULL;
-- The grouping includes credential identity: unrelated accounts on one origin are never merged.
CREATE TEMP TABLE provider_migration_map ON COMMIT DROP AS
SELECT c.id AS model_id, first_value(c.id) OVER(PARTITION BY v.config->>'baseUrl',v.credential_ref ORDER BY c.id) AS provider_id
FROM model_connections c JOIN model_connection_versions v ON v.connection_id=c.id AND v.version=c.current_version;
INSERT INTO providers(id,enabled,created_by)
SELECT m.provider_id,bool_or(c.enabled), (array_agg(c.created_by ORDER BY c.id))[1]
FROM provider_migration_map m JOIN model_connections c ON c.id=m.model_id GROUP BY m.provider_id;
INSERT INTO provider_versions(provider_id,version,config,credential_ref,created_by)
SELECT p.id,1,jsonb_build_object('name',v.config->>'name','baseUrl',v.config->>'baseUrl',
 'auth',jsonb_build_object('type','bearer','header','x-api-key'),'headers','{}'::jsonb,'enabled',p.enabled,
 'resultOrigins',COALESCE((SELECT jsonb_agg(DISTINCT substring(j.result_url from '^https://[^/]+')) FROM generation_jobs j
 JOIN provider_migration_map mm ON mm.model_id=j.connection_id WHERE mm.provider_id=p.id AND j.result_url LIKE 'https://%'),'[]'::jsonb)),v.credential_ref,p.created_by
FROM providers p JOIN model_connections c ON c.id=p.id JOIN model_connection_versions v ON v.connection_id=c.id AND v.version=c.current_version;

INSERT INTO managed_model_versions(model_id,version,provider_id,definition)
SELECT c.id,c.current_version,m.provider_id,'{"version":1,"outputKind":"image","modes":[{"id":"text","label":"文字生图","minMedia":0,"roles":[]},{"id":"reference","label":"参考图生图","minMedia":1,"roles":[{"role":"reference_image","max":1,"min":1,"maxBytes":45000000,"mimeTypes":["image/png","image/jpeg","image/webp"]}]}],"parameters":[{"key":"resolution","label":"分辨率","type":"enum","default":"1K","required":true,"options":["1K","2K","4K"]}],"constraints":[],"protocol":{"version":1,"execution":"sync","submit":{"path":"v1/chat/completions","body":{"model":{"$ref":"model"},"stream":false,"quality":{"$ref":"params.resolution","map":{"1K":"1k","2K":"2k","4K":"4k"}},"messages":[{"role":"user","content":{"$when":{"field":"mode","equals":"text"},"then":{"$ref":"prompt"},"else":{"$concat":[[{"type":"text","text":{"$ref":"prompt"}}],{"$media":{"type":"image_url","image_url":{"url":{"$ref":"item.dataUrl"}}}}]}}}]}},"result":{"path":"choices.0.message.content","format":"markdown"}},"pricing":{"selector":"resolution","rates":[{"value":"1K","perRequestMilliYuan":28,"outputSecondMilliYuan":0,"inputVideoSecondMilliYuan":0,"extraImageMilliYuan":0,"freeImages":0},{"value":"2K","perRequestMilliYuan":120,"outputSecondMilliYuan":0,"inputVideoSecondMilliYuan":0,"extraImageMilliYuan":0,"freeImages":0},{"value":"4K","perRequestMilliYuan":210,"outputSecondMilliYuan":0,"inputVideoSecondMilliYuan":0,"extraImageMilliYuan":0,"freeImages":0}],"durationParameter":"duration"}}'::jsonb FROM model_connections c JOIN model_connection_versions v ON v.connection_id=c.id AND v.version=c.current_version JOIN provider_migration_map m ON m.model_id=c.id WHERE v.config->>'protocol'='tuzi-gpt-image-2';

INSERT INTO managed_model_versions(model_id,version,provider_id,definition)
SELECT c.id,c.current_version,m.provider_id,'{"version":1,"outputKind":"video","modes":[{"id":"text","label":"文生视频","minMedia":0,"roles":[]},{"id":"frames","label":"首尾帧","minMedia":0,"roles":[{"role":"first_frame","max":1,"min":1,"maxBytes":30000000,"mimeTypes":["image/png","image/jpeg","image/webp"],"minDimension":256,"maxDimension":5760,"minRatio":0.4,"maxRatio":2.5},{"role":"last_frame","max":1,"min":0,"maxBytes":30000000,"mimeTypes":["image/png","image/jpeg","image/webp"],"minDimension":256,"maxDimension":5760,"minRatio":0.4,"maxRatio":2.5}]},{"id":"references","label":"多媒体参考","minMedia":1,"roles":[{"role":"reference_image","max":9,"min":0,"maxBytes":30000000,"mimeTypes":["image/png","image/jpeg","image/webp"],"minDimension":256,"maxDimension":5760,"minRatio":0.4,"maxRatio":2.5},{"role":"reference_video","max":3,"min":0,"maxBytes":45000000,"mimeTypes":["video/mp4"],"minSeconds":2,"maxSeconds":15,"totalSeconds":15,"minFps":23.976,"maxFps":60},{"role":"reference_audio","max":3,"min":0,"maxBytes":15000000,"mimeTypes":["audio/mpeg","audio/wav"],"minSeconds":2,"maxSeconds":15,"totalSeconds":15}]}],"parameters":[{"key":"resolution","label":"分辨率","type":"enum","default":"768P","required":true,"options":["768P","2K"]},{"key":"duration","label":"时长（秒）","type":"integer","default":5,"required":true,"min":4,"max":15},{"key":"ratio","label":"宽高比","type":"enum","default":"16:9","required":true,"options":["21:9","16:9","4:3","1:1","3:4","9:16","adaptive"],"fixedWhen":{"when":{"field":"mode","equals":"frames"},"value":"adaptive"}}],"constraints":[{"all":[{"field":"mode","equals":"text"},{"field":"params.ratio","equals":"adaptive"}],"message":"文生视频必须选择固定宽高比"}],"protocol":{"version":1,"execution":"async","submit":{"path":"v2/video_generation","body":{"model":{"$ref":"model"},"duration":{"$ref":"params.duration"},"resolution":{"$ref":"params.resolution"},"ratio":{"$ref":"params.ratio"},"content":{"$concat":[[{"type":"text","text":{"$ref":"prompt"}}],{"$media":{"$when":{"field":"item.type","equals":"image_url"},"then":{"type":"image_url","role":{"$ref":"item.role"},"image_url":{"url":{"$ref":"item.dataUrl"}}},"else":{"$when":{"field":"item.type","equals":"video_url"},"then":{"type":"video_url","role":{"$ref":"item.role"},"video_url":{"url":{"$ref":"item.dataUrl"}}},"else":{"type":"audio_url","role":{"$ref":"item.role"},"audio_url":{"url":{"$ref":"item.dataUrl"}}}}}}]}}},"result":{"path":"task.content.url","format":"url"},"query":{"path":"v2/query/video_generation/{taskId}","taskIdPath":"task_id","statusPath":"task.status","states":{"queued":"queued","running":"running","succeeded":"succeeded","failed":"failed","cancelled":"cancelled"}}},"pricing":{"selector":"resolution","rates":[{"value":"768P","perRequestMilliYuan":0,"outputSecondMilliYuan":250,"inputVideoSecondMilliYuan":250,"extraImageMilliYuan":100,"freeImages":5},{"value":"2K","perRequestMilliYuan":0,"outputSecondMilliYuan":400,"inputVideoSecondMilliYuan":400,"extraImageMilliYuan":100,"freeImages":5}],"durationParameter":"duration"}}'::jsonb FROM model_connections c JOIN model_connection_versions v ON v.connection_id=c.id AND v.version=c.current_version JOIN provider_migration_map m ON m.model_id=c.id WHERE v.config->>'protocol'='tuzi-minimax-h3';
ALTER TABLE generation_requests ADD COLUMN execution_snapshot jsonb;
ALTER TABLE generation_jobs ADD COLUMN execution_snapshot jsonb;
