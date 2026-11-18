import type { Actor, Film, Suggestion } from '#shared/types/game'

/**
 * Small hand-picked film set used when no TMDB key is configured,
 * so the game is playable straight away. Images are null (the UI draws pixel avatars).
 */
const FILMS: { title: string, year: string, cast: string[] }[] = [
  { title: 'The Dark Knight', year: '2008', cast: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart', 'Michael Caine', 'Maggie Gyllenhaal', 'Gary Oldman', 'Morgan Freeman'] },
  { title: 'Batman Begins', year: '2005', cast: ['Christian Bale', 'Michael Caine', 'Liam Neeson', 'Katie Holmes', 'Gary Oldman', 'Cillian Murphy', 'Morgan Freeman', 'Ken Watanabe'] },
  { title: 'Inception', year: '2010', cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page', 'Tom Hardy', 'Ken Watanabe', 'Cillian Murphy', 'Marion Cotillard', 'Michael Caine'] },
  { title: 'Interstellar', year: '2014', cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain', 'Michael Caine', 'Matt Damon', 'Casey Affleck', 'Mackenzie Foy', 'Wes Bentley'] },
  { title: 'The Wolf of Wall Street', year: '2013', cast: ['Leonardo DiCaprio', 'Jonah Hill', 'Margot Robbie', 'Matthew McConaughey', 'Kyle Chandler', 'Jean Dujardin'] },
  { title: 'The Departed', year: '2006', cast: ['Leonardo DiCaprio', 'Matt Damon', 'Jack Nicholson', 'Mark Wahlberg', 'Martin Sheen', 'Vera Farmiga', 'Alec Baldwin'] },
  { title: 'Titanic', year: '1997', cast: ['Leonardo DiCaprio', 'Kate Winslet', 'Billy Zane', 'Kathy Bates', 'Frances Fisher', 'Bill Paxton', 'Gloria Stuart'] },
  { title: 'Good Will Hunting', year: '1997', cast: ['Matt Damon', 'Robin Williams', 'Ben Affleck', 'Minnie Driver', 'Stellan Skarsgård', 'Casey Affleck'] },
  { title: 'Ocean\'s Eleven', year: '2001', cast: ['George Clooney', 'Brad Pitt', 'Matt Damon', 'Julia Roberts', 'Andy García', 'Don Cheadle', 'Casey Affleck', 'Elliott Gould', 'Carl Reiner'] },
  { title: 'Fight Club', year: '1999', cast: ['Brad Pitt', 'Edward Norton', 'Helena Bonham Carter', 'Meat Loaf', 'Jared Leto'] },
  { title: 'Se7en', year: '1995', cast: ['Brad Pitt', 'Morgan Freeman', 'Gwyneth Paltrow', 'R. Lee Ermey'] },
  { title: 'The Shawshank Redemption', year: '1994', cast: ['Tim Robbins', 'Morgan Freeman', 'Bob Gunton', 'William Sadler', 'Clancy Brown'] },
  { title: 'Mystic River', year: '2003', cast: ['Sean Penn', 'Tim Robbins', 'Kevin Bacon', 'Laurence Fishburne', 'Marcia Gay Harden', 'Laura Linney'] },
  { title: 'Apollo 13', year: '1995', cast: ['Tom Hanks', 'Kevin Bacon', 'Bill Paxton', 'Gary Sinise', 'Ed Harris', 'Kathleen Quinlan'] },
  { title: 'Forrest Gump', year: '1994', cast: ['Tom Hanks', 'Robin Wright', 'Gary Sinise', 'Sally Field', 'Mykelti Williamson'] },
  { title: 'Saving Private Ryan', year: '1998', cast: ['Tom Hanks', 'Matt Damon', 'Tom Sizemore', 'Edward Burns', 'Barry Pepper', 'Giovanni Ribisi', 'Vin Diesel', 'Adam Goldberg'] },
  { title: 'A Few Good Men', year: '1992', cast: ['Tom Cruise', 'Jack Nicholson', 'Demi Moore', 'Kevin Bacon', 'Kiefer Sutherland', 'Kevin Pollak', 'Cuba Gooding Jr.'] },
  { title: 'Jerry Maguire', year: '1996', cast: ['Tom Cruise', 'Cuba Gooding Jr.', 'Renée Zellweger', 'Kelly Preston', 'Jerry O\'Connell', 'Jonathan Lipnicki'] },
  { title: 'Mission: Impossible', year: '1996', cast: ['Tom Cruise', 'Jon Voight', 'Emmanuelle Béart', 'Jean Reno', 'Ving Rhames', 'Henry Czerny', 'Kristin Scott Thomas', 'Vanessa Redgrave'] },
  { title: 'Pulp Fiction', year: '1994', cast: ['John Travolta', 'Samuel L. Jackson', 'Uma Thurman', 'Bruce Willis', 'Ving Rhames', 'Tim Roth', 'Harvey Keitel', 'Christopher Walken'] },
  { title: 'Die Hard', year: '1988', cast: ['Bruce Willis', 'Alan Rickman', 'Bonnie Bedelia', 'Reginald VelJohnson'] },
  { title: 'Die Hard with a Vengeance', year: '1995', cast: ['Bruce Willis', 'Samuel L. Jackson', 'Jeremy Irons'] },
  { title: 'The Avengers', year: '2012', cast: ['Robert Downey Jr.', 'Chris Evans', 'Mark Ruffalo', 'Chris Hemsworth', 'Scarlett Johansson', 'Jeremy Renner', 'Tom Hiddleston', 'Samuel L. Jackson'] },
  { title: 'Lost in Translation', year: '2003', cast: ['Bill Murray', 'Scarlett Johansson', 'Giovanni Ribisi', 'Anna Faris'] },
  { title: 'Ghostbusters', year: '1984', cast: ['Bill Murray', 'Dan Aykroyd', 'Sigourney Weaver', 'Harold Ramis', 'Rick Moranis', 'Ernie Hudson', 'Annie Potts'] },
  { title: 'Alien', year: '1979', cast: ['Sigourney Weaver', 'Tom Skerritt', 'John Hurt', 'Ian Holm', 'Veronica Cartwright', 'Harry Dean Stanton', 'Yaphet Kotto'] },
  { title: 'The Lord of the Rings: The Fellowship of the Ring', year: '2001', cast: ['Elijah Wood', 'Ian McKellen', 'Viggo Mortensen', 'Sean Astin', 'Orlando Bloom', 'Cate Blanchett', 'Ian Holm', 'Sean Bean', 'Christopher Lee', 'Liv Tyler', 'Hugo Weaving'] },
  { title: 'The Matrix', year: '1999', cast: ['Keanu Reeves', 'Laurence Fishburne', 'Carrie-Anne Moss', 'Hugo Weaving', 'Joe Pantoliano'] },
  { title: 'Speed', year: '1994', cast: ['Keanu Reeves', 'Sandra Bullock', 'Dennis Hopper', 'Jeff Daniels'] },
  { title: 'Gravity', year: '2013', cast: ['Sandra Bullock', 'George Clooney'] },
  { title: 'Pirates of the Caribbean: The Curse of the Black Pearl', year: '2003', cast: ['Johnny Depp', 'Geoffrey Rush', 'Orlando Bloom', 'Keira Knightley', 'Jack Davenport', 'Jonathan Pryce'] },
  { title: 'Edward Scissorhands', year: '1990', cast: ['Johnny Depp', 'Winona Ryder', 'Dianne Wiest', 'Anthony Michael Hall', 'Vincent Price', 'Alan Arkin'] },
  { title: 'Notting Hill', year: '1999', cast: ['Julia Roberts', 'Hugh Grant', 'Rhys Ifans', 'Emma Chambers', 'Tim McInnerny'] },
  { title: 'Love Actually', year: '2003', cast: ['Hugh Grant', 'Liam Neeson', 'Colin Firth', 'Emma Thompson', 'Alan Rickman', 'Keira Knightley', 'Bill Nighy', 'Martin Freeman', 'Andrew Lincoln'] },
  { title: 'Sense and Sensibility', year: '1995', cast: ['Emma Thompson', 'Kate Winslet', 'Alan Rickman', 'Hugh Grant', 'Hugh Laurie'] },
  { title: 'Harry Potter and the Philosopher\'s Stone', year: '2001', cast: ['Daniel Radcliffe', 'Rupert Grint', 'Emma Watson', 'Alan Rickman', 'Maggie Smith', 'Robbie Coltrane', 'Richard Harris', 'John Hurt'] },
]

// Stable ids: actor id = index in actorNames + 1, film id = index in FILMS + 1
const actorIds = new Map<string, number>()
const actorNames: string[] = []
for (const f of FILMS) {
  for (const name of f.cast) {
    if (!actorIds.has(name)) {
      actorIds.set(name, actorNames.length + 1)
      actorNames.push(name)
    }
  }
}

const actor = (name: string): Actor => ({ id: actorIds.get(name)!, name, image: null })

export function demoActorPool(): Actor[] {
  // Only actors in 2+ films make interesting endpoints
  return actorNames
    .filter(n => FILMS.filter(f => f.cast.includes(n)).length >= 2)
    .map(actor)
}

export function demoPersonMovies(id: number): Film[] {
  const name = actorNames[id - 1]
  if (!name) return []
  return FILMS
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.cast.includes(name))
    .map(({ f, i }) => ({ id: i + 1, title: f.title, year: f.year, image: null }))
}

export function demoMovieCast(id: number): Actor[] {
  const f = FILMS[id - 1]
  return f ? f.cast.map(actor) : []
}

const norm = normaliseText

export function demoSearchMovies(q: string): Suggestion[] {
  const n = norm(q)
  return FILMS
    .map((f, i) => ({ id: i + 1, title: f.title, subtitle: f.year, image: null }))
    .filter(f => norm(f.title).includes(n))
    .slice(0, 7)
}

export function demoSearchPeople(q: string): Suggestion[] {
  const n = norm(q)
  return actorNames
    .filter(name => norm(name).includes(n))
    .slice(0, 7)
    .map(name => ({ id: actorIds.get(name)!, title: name, image: null }))
}
