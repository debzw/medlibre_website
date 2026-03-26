-- Garante que o trigger on_auth_user_created existe.
-- Esse trigger chama handle_new_user() para criar o user_profile após signup.
-- Pode ter sido perdido se o banco foi recriado ou o trigger foi criado manualmente.

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
