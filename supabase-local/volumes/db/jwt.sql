\set jwt_secret `echo "${JWT_SECRET:?JWT_SECRET is required}"`
\set jwt_exp `echo "${JWT_EXP:?JWT_EXP is required}"`

ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwt_secret';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';
