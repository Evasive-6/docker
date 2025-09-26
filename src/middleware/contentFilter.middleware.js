const badWords=["abuseword1","abuseword2","abuseword3"]

const filterBadWords=(req,res,next)=>{

    let{description,suggestedSolution}=req.body

    const cleanText=(text)=>{
        if(!text) return text;
        let modified=text;
        badWords.forEach((word)=>{
            const regex=new RegExp(word,"gi");
            modified=modified.replace(regex,"****")
        })
        return modified
    }

    if(description)req.body.description=cleanText(description)
    if(suggestedSolution)req.body.suggestedSolution=cleanText(suggestedSolution)

    next();

}

module.exports=filterBadWords;
