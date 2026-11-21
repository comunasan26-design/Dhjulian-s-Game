# Dhjulian's Game

Jogo de cartas online de masmorra (3 a 9 jogadores) baseado no livro de regras do projeto: chute portas, derrote monstros, use
raças, classes, itens, runas, poções e maldições, e seja o primeiro a chegar ao **nível 20**.

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4** + **ESLint**
- **SQLite** com **Prisma 7** (`@prisma/adapter-better-sqlite3`): o banco é um arquivo em `prisma/jogo.db`, criado sozinho
- Contas só com **usuário e senha** (bcrypt + sessão em cookie httpOnly guardada no banco)
- **Salas** com código de convite, sala de espera e **reconexão** (o estado da partida fica no banco)
- **Tempo real** com Server-Sent Events, sem serviço externo
- **Bots** com IA nas salas online (o anfitrião adiciona na sala de espera)
- **Modo local** (`/local`): partida contra bots rodando só no navegador, sem conta e sem banco (salva no aparelho)
- Layout para celular com abas (Mesa, Você, Jogadores, Histórico)
- **Cartas editáveis em JSON** (pasta [`cartas/`](cartas/LEIA-ME.md)): qualquer pessoa altera ou cria cartas mudando textos e números
- **Visual de cartas de verdade**: moldura de metal pela raridade (cobre, bronze, prata, ouro, ferro negro), gema no topo pelo tipo, runas circulando itens encantados; segure uma carta para erguê-la e toque para virar e ler o verso
- **Trilha sonora dinâmica** (gerada com Web Audio, sem arquivos): muda entre exploração, combate, chefe lendário, vitória e derrota; efeitos sonoros e **animações Lottie** (`public/animacoes/`) em eventos como subir de nível, combate, monstro derrotado, morte, maldição, runa e fim de jogo
- Ameaçar atrapalhar (pedir tesouros para não atrapalhar) e desistir da partida

## Rodando localmente

Requisitos: Node 20.9+. Não precisa instalar banco de dados: o SQLite fica no arquivo `prisma/jogo.db`.

```bash
npm install            # também gera o Prisma Client
npx prisma migrate dev # cria prisma/jogo.db com as tabelas
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
| `npm run cartas:validar` | Confere os arquivos de cartas e mostra erros em português |
| `npm run cartas:docs` | Gera `cartas/EFEITOS.md` (lista de efeitos disponíveis) |
| `npm run animacoes` | Regera as animações Lottie em `public/animacoes/` (pode trocar qualquer uma por outra Lottie de mesmo nome) |

## Deploy no Pterodactyl (ou outro servidor com Node.js)

Use um egg de Node.js (versão 20.9 ou mais nova) com pelo menos **2 GB de RAM** (a compilação passa de 1,5 GB).

1. Copie [`deploy/iniciar.cjs`](deploy/iniciar.cjs) para a raiz do servidor (gerenciador de arquivos → novo arquivo
   `iniciar.cjs`) e use **Main file**: `iniciar.cjs`. A cada inicialização ele baixa a versão mais nova do GitHub
   (variáveis do painel **Git Repo Address** e **Install Branch**; sem elas, este repositório e o `main`) e chama
   [`deploy/start.cjs`](deploy/start.cjs), que instala as dependências, compila quando o código muda, cria/atualiza o
   banco e sobe o servidor na porta do painel (`SERVER_PORT`).
2. O banco SQLite é criado sozinho em `prisma/jogo.db` e tudo é gravado direto nele. Para fazer
   backup, copie a pasta `prisma/` com o servidor parado. As atualizações pelo GitHub não mexem nesses arquivos.
3. Sem domínio com HTTPS, crie um `.env` na raiz com `COOKIE_SECURE="false"` para o login funcionar por
   `http://IP:porta`.

Para outro caminho do banco, use `DATABASE_URL="file:caminho/arquivo.db"` no `.env` (relativo à pasta do projeto).

**Vercel:** o SQLite precisa de disco permanente, que as funções da Vercel não têm. Para hospedar lá, seria preciso
voltar para um banco externo (PostgreSQL).

## Como funciona

```
cartas/             # TODAS as cartas em JSON (edite aqui) + LEIA-ME.md e EFEITOS.md
src/
  game/catalog/     # carrega e valida os JSON de cartas; registro de efeitos
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
- **Bots** (`src/game/bot/ai.ts`): simulam as jogadas no próprio motor e procuram o **combo** mais barato de cartas e
  habilidades que vira um combate (o deles, ou o de quem eles querem derrubar), guardando o resto para depois. Procuram
  encrenca quando um combo garante a vitória com folga contra o que os outros podem jogar, avaliam a montagem de
  raça/classe/itens como um todo (Bárbaro sem armadura, Monge sem armas…), vendem o que não usam para subir de nível,
  usam a mão que iria para a Caridade e gastam tudo para impedir que alguém chegue ao nível máximo. Pesam o risco de
  fugir (Coisas Ruins), aliam-se a outros bots contra humanos e contra o líder e propõem trocas por itens exclusivos da
  sua raça/classe. Nas salas online, o servidor faz os bots agirem pelo mesmo stream de eventos (um passo a cada
  ~0,9 s); no modo local, o navegador.
- **Cartas**: o motor não conhece cartas pelo nome; ele lê os `"efeitos"` de cada carta (ex.: `bonusContra`, `anula`,
  `naoPersegue`). Assim, cartas novas podem reaproveitar qualquer efeito existente. Veja `cartas/LEIA-ME.md`.
- **Ameaça**: quem não está no combate pode pedir tesouros para não atrapalhar. Se o lutador aceitar, paga com a
  recompensa (se vencer) e quem ameaçou não pode atrapalhá-lo pelo resto da rodada.
- **Desistência**: conta como morte (os outros saqueiam os itens) e o jogador sai da mesa. Se só restarem bots, a sala
  é apagada; se restar um único jogador, ele vence.
- **Reconexão**: basta voltar à sala (o lobby lista “Suas salas”). Recarregar a página ou perder a internet não perde nada.

## Regras e interpretações

A página `/regras` resume as regras e lista todas as cartas. Onde o livro era ambíguo, as escolhas adotadas estão na seção
“Interpretações adotadas” dessa página (por exemplo: o limite do Anão foi tratado como limite de mão, e o Desafio do Guerreiro
dobra os níveis ganhos). As cartas que o livro cita mas não define (Bônus de Monstro, Monstro Errante e Subir de Nível)
foram criadas com nomes próprios.

Os nomes de monstros vêm do SRD 5.1 do D&D (CC-BY-4.0, Wizards of the Coast). O app evita usar nomes de marcas
registradas na interface; troque o título em `src/app/layout.tsx` se quiser outro nome.
