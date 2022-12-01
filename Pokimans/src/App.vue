<script>
var request = new XMLHttpRequest();


const app = document.querySelector('#root');
const container = document.createElement('div')

container.setAttribute('class', 'container')

app.appendChild(container);


request.open("GET", "https://pokeapi.co/api/v2/pokemon?limit=151&offset=0", true);
request.onload = function () {
  var data = JSON.parse(this.response);


  if (request.status >= 200 && request.status < 400) {
    data.results.forEach((pokemon) => {


      const card = document.createElement('div')
      card.setAttribute('class', 'card')

      fetch(pokemon.url)
      .then(response => response.json())
      .then(data => {
        const img = document.createElement('img')
        img.setAttribute('class', 'img')
        img.src = data.sprites.front_default
        card.appendChild(img)

        const type = document.createElement('type')
        type.setAttribute('class', 'pokemontype')
        type.src = data.sprites.front_default
        card.appendChild(type)
      })


      const pokemonName = document.createElement('div')
      pokemonName.innerText = pokemon.name
      pokemonName.setAttribute('class', 'name')

      
      container.appendChild(card)
      card.appendChild(pokemonName);
    });
  } else {
    console.log(error);
  }
};
request.send();
</script>



<style>
#root{
  background-color: red;
}

.card{
  margin: 1rem;
  border: 2px solid black;
  box-shadow: 2px 4px 25px black;
  border-radius: 50px;
  overflow: hidden;
  transition: all .2s linear;
  width: 10%;
  background-color: darkred;
}

.container{
  display: flex;
  flex-wrap: wrap;
}

.name{
  text-align: center;
  margin: 0 0 0rem 0;
  font-size: 1rem;
}
</style>