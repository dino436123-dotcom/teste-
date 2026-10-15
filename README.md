# Serena — Agenda & Rotina

Aplicação web instalável (PWA) em português brasileiro, com visual bege, branco e verde-sálvia.

## Recursos incluídos
- Calendário mensal e compromissos com categoria, observações e opção de compartilhamento.
- Lista de tarefas com prazo, prioridade, edição, conclusão e exclusão.
- Hábitos semanais com marcação por dia.
- Resumo semanal de tarefas, compromissos e hábitos.
- Exportação/importação de backup JSON.
- Dados salvos no dispositivo via IndexedDB, com fallback para localStorage.
- Arquivos estáticos em cache para abrir a interface offline depois da primeira visita.
- Solicitação de permissão para notificações do navegador.

## Como testar no computador

1. Extraia a pasta `serena_agenda`.
2. Abra um terminal dentro dela.
3. Execute um servidor local. Se tiver Python instalado:
   ```bash
   python -m http.server 8000
   ```
4. Abra `http://localhost:8000`.

Abrir o arquivo `index.html` diretamente (`file://`) permite testar parte da interface, mas instalação PWA, service worker e notificações precisam de `localhost` ou hospedagem HTTPS.

## Como instalar no celular

1. Publique os arquivos em um host HTTPS (por exemplo, GitHub Pages).
2. Abra o endereço no navegador do celular.
3. iPhone: Safari → botão Compartilhar → Adicionar à Tela de Início.
4. Android: Chrome → menu → Instalar app / Adicionar à tela inicial.

A disponibilidade e o comportamento de instalação variam por navegador e sistema operacional.

## Limitações conhecidas da versão inicial
- Os lembretes por Notification API são agendados em memória e só funcionam de forma confiável enquanto a página permanece aberta. Navegadores podem suspender timers; notificações no horário exato com o app fechado exigem uma solução adicional (por exemplo, push com servidor/service worker ou aplicativo nativo).
- Compartilhamento é manual: abre o menu de compartilhamento do sistema ou copia/prepara o texto. Não há sincronização automática para o namorado.
- Os dados são locais ao navegador/aparelho. Exporte backups regularmente. Desinstalar ou limpar os dados do navegador pode apagar a agenda.
- O relatório semanal usa a semana de segunda a domingo atual; tarefas concluídas guardam data/hora de conclusão.
- A fonte Google Fonts é opcional; se estiver offline, o sistema usa fontes de reserva.

## Próximas melhorias recomendadas
- Testes de acessibilidade e validação em dispositivos reais.
- Repetição automática de compromissos e tarefas.
- Melhorias de edição de metas, busca e filtros por categoria.
- Lembretes push com backend e consentimento explícito.
- Compartilhamento seletivo por link seguro com expiração, se desejado.

## Privacidade
Não há analytics nem envio automático dos dados da agenda para um servidor. A publicação hospeda somente os arquivos do aplicativo; os registros pessoais permanecem no armazenamento local do navegador, exceto quando a usuária decide compartilhar ou exportar.
