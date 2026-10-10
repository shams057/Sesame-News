module.exports=(sequelize,Datatype)=>{
    const categorie=sequelize.define("categorie",{
        libelle:{
            type:Datatype.STRING(20),
            allowNull:false,
            unique: true
        },
       
    })
    categorie.associate=models=>{
        categorie.hasMany(models.user,{
            onDelete:"cascade"
        })
        categorie.hasMany(models.news,{
            onDelete:"cascade"
        })
        
    }
    return categorie
}