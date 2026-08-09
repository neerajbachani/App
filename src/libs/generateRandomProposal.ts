export default function generateRandomProposal(): string {
    const words = ['Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', ...];
    let proposal = '';
    while (proposal.length < 700) {
        const newWord = words[Math.floor(Math.random() * words.length)];
        if (proposal.length + newWord.length + 1 <= 700) {
            proposal += (proposal ? ' ' : '') + newWord;
        } else break;
    }
    return proposal;
