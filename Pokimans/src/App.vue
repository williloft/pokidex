<script>
var request = new XMLHttpRequest();


const app = document.querySelector('#root');
const container = document.createElement('div')
container.setAttribute('class', 'container')


app.appendChild(container);


//her har vi vores connection til api url'en
request.open("GET", "https://pokeapi.co/api/v2/pokemon?limit=151&offset=0", true);
request.onload = function () {
  var data = JSON.parse(this.response);


  //her tester vi om vi har fået connection til api url'en
  if (request.status >= 200 && request.status < 400) {
    data.results.forEach((pokemon) => {


      //her laver vi cardet som er vores røde boxe
      const card = document.createElement('div')
      card.setAttribute('class', 'card')


      //her laver vi en connection til api url'en for den enkelte pokemon for at få fat i pokemon billedet
      fetch(pokemon.url)
      .then(response => response.json())
      .then(data => {
        

        //her laver vi billedet
        const img = document.createElement('img')
        img.setAttribute('class', 'img')
        img.src = data.sprites.other.home.front_shiny
        //img.src = data.sprites.other.home.front_default
        card.appendChild(img)


        //her laver vi pokemon typesne
        data.types.forEach((types) => {
        const type = document.createElement('p')
        type.setAttribute('class', 'pokemontype')
        type.innerText = types.type.name
        card.appendChild(type)})
      })


      //her laver vi pokemon navnet
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
  background-color: rgb(36, 36, 36);
}

.h1{
  text-align: center;
  margin: 0 0 0rem 0;
  font-size: 3rem;
  color: white;
  text-shadow: 1px 1px 0 #000, 
               -1px 1px 0 #000, 
               1px -1px 0 #000, 
               -1px -1px 0 #000;
}

.p{
  text-align: center;
  margin: 0 0 0rem 0;
  font-size: 1.5rem;
  color: white;
  text-shadow: 1px 1px 0 #000, 
               -1px 1px 0 #000, 
               1px -1px 0 #000, 
               -1px -1px 0 #000;
}

.card{
  margin: 1rem;
  border: 3px solid black;
  border-radius: 10px;
  overflow: hidden;
  transition: all .2s linear;
  width: 25%;
  background-color: rgb(151, 57, 57);
}

.card:hover {
    transform: scale(1.05);
    box-shadow: 2px 4px 25px rgba(0, 0, 0, 0.2);
}

.container{
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

.name{
  text-align: center;
  margin: 0 0 0rem 0;
  font-size: 3rem;
  color: white;
  text-shadow: 1px 1px 0 #000, 
               -1px 1px 0 #000, 
               1px -1px 0 #000, 
               -1px -1px 0 #000;
}

.pokemontype{
  text-align: center;
  margin: 0 0 0rem 0;
  font-size: 1.5rem;
  color: white;
  text-shadow: 1px 1px 0 #000, 
               -1px 1px 0 #000, 
               1px -1px 0 #000, 
               -1px -1px 0 #000;
}

.img{
  filter: drop-shadow(0px 0px 10px rgba(0, 0, 0, 1));
  width: 50%;
  margin-left: 25%;
}
</style>