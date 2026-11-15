# gingaiteste

Cópia de estudo do GingAI (projeto do professor), mantida em repositório separado para não
mexer no código original. Dança com o celular no bolso, festa com QR Code, telão, ranking ao
vivo e o "baile de robôs", agora com a opção de comandar os carrinhos reais do Baile 10D.

Autoria das alterações: Victor Lustosa.

## O que mudou em relação ao GingAI original

- Visual no padrão do site do Baile 10D: fundo claro, rosa `#f62681` como cor única, cartões
  brancos com borda rosa, sem gradientes e com menos emojis.
- Nome exibido "GingAI Teste" (constante em `apps/web/src/lib/app-info.ts`).
- `apps/web/src/lib/robots-link.ts`: publica `DN0EST<estilo>,<bpm>,<t0>` no tópico `cmd` do
  broker dos robôs. Na página `/e/CODIGO/robos`, o dono da festa marca "Comandar os robôs reais".
- Criar festa exige login (antes a tela travava sem aviso quando o banco recusava).
- `supabase/schema.sql`: banco completo para um projeto Supabase novo.
- Hospedagem na Vercel (o `amplify.yml` foi removido).

## Estrutura (npm workspaces)

| Pasta | O que é |
| --- | --- |
| `packages/core` | TypeScript puro: características do movimento, pontuação, classificador, coreografia. Testes com Vitest. |
| `apps/web` | Next.js 16 + Tailwind 4. É o que vai para a Vercel. |
| `apps/mobile` | Expo / React Native. Não vai para a Vercel; faltam os ícones em `apps/mobile/assets/`. |
| `supabase` | `schema.sql` e `config.toml`. |

## Rodar no computador

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # e preencha as chaves
npm run dev:web                                # http://localhost:3000
npm test                                       # testes do core
npm run build:web                              # mesmo build que a Vercel faz
```

Sensores de movimento no navegador só funcionam em HTTPS, então o teste com o celular de
verdade é feito no endereço da Vercel.

## Publicar

Passo a passo completo no PDF "Como colocar o gingaiteste online". Resumo:

1. Supabase novo, rodar `supabase/schema.sql` no SQL Editor.
2. Google OAuth ligado no Supabase.
3. Vercel: importar o repositório, Root Directory `apps/web`, cadastrar as variáveis do
   `.env.example`.
4. Copiar a URL da Vercel para as Redirect URLs do Supabase.

## Limites conhecidos

- O modelo global (`global_models`) é preenchido por uma rotina de servidor do projeto original
  que não veio junto. Sem ela, o app usa o modelo heurístico e o modelo pessoal de cada um.
- As regras de acesso do `schema.sql` foram reconstruídas e podem diferir das do professor.
