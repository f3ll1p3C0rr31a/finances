-- Desfaz a integração Pluggy (open finance), descartada em 2026-08-18: as
-- conexões com os bancos caíam o tempo todo e exigiam reconexão manual, então
-- o app voltou a ser só de lançamento manual.
--
-- A migration 20260709120000_pluggy_integration continua no histórico de
-- propósito: ela já foi aplicada em produção e apagá-la faria o histórico do
-- banco divergir do diretório de migrations. O caminho correto é esta
-- migration, que remove o que aquela criou.
--
-- Nenhuma tabela existente foi alterada por aquela migration, então aqui só há
-- DROPs. Os dados perdidos são apenas o vínculo com o Pluggy e o registro de
-- quais transações já tinham sido importadas; os lançamentos gerados a partir
-- delas são registros normais e permanecem intactos.

DROP TABLE IF EXISTS "PluggyImportedTransaction";
DROP TABLE IF EXISTS "PluggyAccountLink";
DROP TABLE IF EXISTS "PluggyConnection";

DROP TYPE IF EXISTS "PluggyImportTarget";
DROP TYPE IF EXISTS "PluggyAccountType";
