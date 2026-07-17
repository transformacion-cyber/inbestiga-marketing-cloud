-- ROLLBACK MANUAL EXCLUSIVO DE SAKURA v17.12.13.
-- No ejecutar salvo que se decida retirar por completo el almacenamiento compartido de SAKURA.
begin;
drop table if exists marketing_app.sakura_action_audit;
drop table if exists marketing_app.sakura_learning_proposals;
drop table if exists marketing_app.sakura_user_preferences;
drop table if exists marketing_app.sakura_knowledge;
drop function if exists marketing_app.ibm_v171213_sakura_is_director();
drop function if exists marketing_app.ibm_v171213_sakura_is_manager();
drop function if exists marketing_app.ibm_v171213_sakura_member();
commit;
