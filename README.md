# Estamos Juntos, Amor… Sempre ❤️

Jogo romântico para duas pessoas, criado para jogar à distância ou lado a lado.

## O que inclui
- Salas privadas com código de 5 caracteres.
- Dois jogadores por sala.
- 12 categorias e **1.080 perguntas/desafios** no ficheiro de perguntas (90 por categoria).
- Perguntas românticas, divertidas, profundas, de gratidão, sobre o futuro, sobre a distância e uma categoria atrevida não explícita.
- Respostas em tempo real, revelação das respostas pelo anfitrião e pontuação de carinho.
- Chat privado dentro da sala.
- Escolha de categoria e de 3 a 30 rondas.
- Sorteio sem repetir perguntas durante a mesma partida, enquanto houver perguntas disponíveis na categoria escolhida.
- Reinício da partida.
- Layout adaptado a telemóvel, tablet e computador.
- Endpoint `/health` para verificar se o servidor está ativo.

## Requisitos
- Node.js 18 ou superior.
- Uma conta de alojamento Node (por exemplo, Render) para jogar online com outra pessoa.

## Testar no computador
1. Descarrega e extrai o ZIP.
2. Instala Node.js 18 ou superior: https://nodejs.org/
3. Abre a pasta extraída.
4. Abre um terminal nessa pasta e executa:

   ```bash
   npm install
   npm start
   ```

5. Abre http://localhost:3000 no navegador.

Para testar a versão online, publica a aplicação num serviço de alojamento e abre a URL pública em dois dispositivos/navegadores.

## Publicar no Render
1. Cria um repositório GitHub e carrega **todos os ficheiros desta pasta** (incluindo `package.json`, `server.js` e a pasta `public`).
2. No Render, escolhe **New + → Web Service** e liga o repositório.
3. Configura:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Clica em **Create Web Service** e espera que o deploy termine.
5. Abre o URL `https://...onrender.com` que o Render fornecer.
6. Envia o URL à outra pessoa. Uma pessoa cria a sala e partilha o código; a outra escolhe o seu nome, escreve o mesmo código e entra.

### Variáveis de ambiente opcionais
- `PORT`: definido automaticamente pelo Render; não precisas de o configurar manualmente.
- `PUBLIC_URL`: URL público (opcional; usado apenas no log).
- `ADMIN_PASSWORD`: reservado para futura área administrativa; não é necessário para jogar.

## Como jogar
1. Cada pessoa abre o site no seu dispositivo.
2. A primeira pessoa escreve o nome, escolhe categoria, número de rondas e modo online, e carrega em **Criar sala privada**.
3. Partilha o código de cinco caracteres.
4. A segunda pessoa escreve o nome e o código, e carrega em **Entrar**.
5. O anfitrião carrega em **Começar a jogar**.
6. Ambos respondem à pergunta. Quando as duas respostas forem recebidas, o anfitrião revela-as.
7. O anfitrião pode atribuir pontos de carinho (+1, +2 ou +3) e avançar para a próxima ronda.
8. No final, podem reiniciar a partida.

## Modo juntos — mesmo ecrã
O seletor inclui um modo para usar a sala como anfitrião sem esperar por uma segunda ligação. É útil para experimentar o fluxo e adaptar o jogo a uma sessão no mesmo dispositivo. Para manter respostas verdadeiramente privadas, o ideal é que cada pessoa use o seu próprio dispositivo; a versão online foi pensada para isso.

## Limitações e privacidade
- As salas e mensagens ficam na memória do servidor e desaparecem quando o servidor reinicia ou entra em suspensão. Não existe conta, histórico persistente ou base de dados.
- Não partilhes o código com pessoas que não queiras na sala.
- O chat é destinado a mensagens curtas dentro da sala; não é uma aplicação de mensagens com histórico permanente.
- O jogo não recolhe nem exige dados pessoais além do nome que cada jogador escolhe.
- Esta versão é uma base funcional 1.0; ainda não inclui contas de utilizador, upload de fotografias, áudio real, nem uma área de administração para editar perguntas no navegador.

## Estrutura
```text
estamos-juntos-amor-sempre/
├── package.json
├── server.js
├── README.md
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── questions.json
```

Boa partida — e que a distância nunca vos roube a vontade de criar memórias. ❤️
