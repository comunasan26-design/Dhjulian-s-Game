# Dhjulian's Game

Jogo de cartas online de masmorra (3 a 9 jogadores) baseado no livro de regras do projeto: chute portas, derrote monstros, use
raças, classes, itens, runas, poções e maldições, e seja o primeiro a chegar ao **nível 20**.

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4** + **ESLint**
- **PostgreSQL** com **Prisma 7** (`@prisma/adapter-pg`)
- Contas só com **usuário e senha** (bcrypt + sessão em cookie httpOnly guardada no banco)
- **Salas** com código de convite, sala de espera e **reconexão** (o estado da partida fica no banco)
- **Tempo real** com Server-Sent Events: funciona na Vercel sem serviço externo
- **Bots** com IA nas salas online (o anfitrião adiciona na sala de espera)
- **Modo local** (`/local`): partida contra bots rodando só no navegador, sem conta e sem banco (salva no aparelho)
- Layout para celular com abas (Mesa, Você, Jogadores, Histórico)

## Rodando localmente

Requisitos: Node 20.9+ e um PostgreSQL.

```bash
cp .env.example .env   # ajuste DATABASE_URL
npm install            # também gera o Prisma Client
npx prisma migrate dev # cria as tabelas
npm run dev
```

Abra `http://localhost:3000`, crie uma conta, crie uma sala e mande o código (ou o link) para os amigos.

Scripts úteis:

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificação de tipos |
| `npm test` | Testes do motor de regras (Vitest) |
| `npm run db:migrate` | Nova migração em desenvolvimento |

## Deploy na Vercel

1. Crie um banco PostgreSQL (Neon, Supabase, Prisma Postgres, Vercel Postgres…).
2. Importe o repositório na Vercel.
3. Em **Settings → Environment Variables**, defina:
   - `DATABASE_URL` — URL do Postgres usada pelo app (se o provedor tiver *pooler*, use a URL com pooler).
   - `DIRECT_URL` (opcional) — URL direta, sem pooler, usada só pelo Prisma para aplicar migrações.
4. Faça o deploy. O `vercel.json` usa o script `vercel-build`, que roda `prisma generate`, `prisma migrate deploy`
   (aplica as migrações no banco) e `next build`.

O stream de tempo real (`/api/rooms/[code]/events`) fica aberto até ~55 s e o navegador reconecta sozinho, então funciona
nos limites de duração do plano Hobby. Cada conexão consulta a versão da sala no Postgres a cada ~0,7 s; quem faz a ação
recebe o novo estado na hora e os outros jogadores em menos de 1 s.

## Como funciona

```
src/
  game/catalog/     # todas as cartas do livro (raças, classes, itens, poções, runas, maldições, bestiário)
  game/engine/      # motor de regras puro (sem banco): estado, combate, habilidades, prompts, visão por jogador
  game/bot/         # IA dos bots
  lib/              # Prisma, autenticação, salas (concorrência otimista por versão)
  app/api/          # rotas: auth, salas, ações e stream SSE
  components/       # lobby, sala de espera e mesa de jogo
```

- O **estado completo** da partida fica em `Room.state` (JSON). Cada ação é validada pelo motor no servidor e gravada com
  controle de versão; o cliente só recebe a **visão filtrada** (mãos alheias e ordem dos baralhos nunca saem do servidor).
- Janelas de reação (tempo para interferir antes da vitória, Coisas Ruins, pedidos de ajuda, escolhas) têm prazo; quando
  vencem, o servidor aplica a escolha padrão, então um jogador ausente não trava a mesa. Se o jogador da vez ficar offline por
  mais de 45 s, qualquer um pode pular o turno dele.
- **Janela de ataque**: quando alguém clica em “Atacar”, os outros têm 60 s para interferir ou “Deixar passar”; qualquer
  ação que mude o combate reinicia o contador.
- **Bots** (`src/game/bot/ai.ts`): decidem simulando ações no próprio motor e escolhem a que mais aumenta o ganho deles
  (níveis, poder, vencer monstros), dando peso maior a prejudicar humanos e o líder. Preferem alianças com outros bots
  (menos os que estão quase ganhando) e propõem trocas justas por itens exclusivos da sua raça/classe. Nas salas online,
  o servidor faz os bots agirem pelo mesmo stream de eventos (um passo a cada ~0,9 s); no modo local, o navegador.
- **Reconexão**: basta voltar à sala (o lobby lista “Suas salas”). Recarregar a página ou perder a internet não perde nada.

## Regras e interpretações

A página `/regras` resume as regras e lista todas as cartas. Onde o livro era ambíguo, as escolhas adotadas estão na seção
“Interpretações adotadas” dessa página (por exemplo: o limite do Anão foi tratado como limite de mão, e o Desafio do Guerreiro
dobra os níveis ganhos). As cartas que o livro cita mas não define (Bônus de Monstro, Monstro Errante e Subir de Nível)
foram criadas com nomes próprios.

Os nomes de monstros vêm do SRD 5.1 do D&D (CC-BY-4.0, Wizards of the Coast). O app evita usar nomes de marcas
registradas na interface; troque o título em `src/app/layout.tsx` se quiser outro nome.
